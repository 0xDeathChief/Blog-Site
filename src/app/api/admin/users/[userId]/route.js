import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwnerApi, readJsonBody } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const userIdSchema = z.string().uuid();
const updateSchema = z.object({
  role: z.enum(["owner", "editor", "contributor", "reader"]).optional(),
  status: z.enum(["active", "deactivated"]).optional(),
}).strict().refine((value) => value.role !== undefined || value.status !== undefined);

export async function PATCH(request, context) {
  const authorization = await requireOwnerApi(request, { mutating: true });
  if (authorization.response) return authorization.response;

  const { userId: rawUserId } = await context.params;
  const userId = userIdSchema.safeParse(rawUserId);
  if (!userId.success) {
    return NextResponse.json({ error: "Invalid user ID." }, { status: 400 });
  }

  const parsedBody = await readJsonBody(request);
  if (parsedBody.response) return parsedBody.response;
  const update = updateSchema.safeParse(parsedBody.body);
  if (!update.success) {
    return NextResponse.json({ error: "Provide a role, account status, or both." }, { status: 400 });
  }

  if (
    userId.data === authorization.owner.id
    && (update.data.status === "deactivated" || (update.data.role && update.data.role !== "owner"))
  ) {
    return NextResponse.json(
      { error: "Use another owner account to deactivate or change your own owner role." },
      { status: 409 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("id, role, status")
    .eq("id", userId.data)
    .maybeSingle();

  if (targetError) {
    return NextResponse.json({ error: "Unable to verify the target account." }, { status: 502 });
  }
  if (!target) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const { error: updateError } = await supabase.rpc("admin_update_profile", {
    target_user_id: userId.data,
    new_role: update.data.role ?? null,
    new_status: update.data.status ?? null,
  });

  if (updateError) {
    return NextResponse.json(
      { error: "The role or account status could not be updated." },
      { status: updateError.code === "23514" ? 409 : 502 },
    );
  }

  if (update.data.status) {
    const banDuration = update.data.status === "deactivated" ? "876000h" : "none";
    const { error: authUpdateError } =
      await authorization.adminClient.auth.admin.updateUserById(userId.data, {
        ban_duration: banDuration,
      });

    if (authUpdateError) {
      return NextResponse.json(
        { error: "Database access was updated, but the authentication account could not be synchronized." },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({
    user: {
      id: userId.data,
      role: update.data.role ?? target.role,
      status: update.data.status ?? target.status,
    },
  });
}

export async function DELETE(request, context) {
  const authorization = await requireOwnerApi(request, { mutating: true });
  if (authorization.response) return authorization.response;

  const { userId: rawUserId } = await context.params;
  const userId = userIdSchema.safeParse(rawUserId);
  if (!userId.success) {
    return NextResponse.json({ error: "Invalid user ID." }, { status: 400 });
  }
  if (userId.data === authorization.owner.id) {
    return NextResponse.json(
      { error: "Use another owner account to delete your account." },
      { status: 409 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("id, role, status")
    .eq("id", userId.data)
    .maybeSingle();

  if (targetError) {
    return NextResponse.json({ error: "Unable to verify the target account." }, { status: 502 });
  }
  if (!target) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const { error: auditError } = await supabase.rpc("log_owner_action", {
    action_name: "account_delete_requested",
    target_user: userId.data,
    action_details: { role: target.role, status: target.status },
  });
  if (auditError) {
    return NextResponse.json({ error: "The deletion could not be audited." }, { status: 502 });
  }

  const { error: deleteError } =
    await authorization.adminClient.auth.admin.deleteUser(userId.data);
  if (deleteError) {
    return NextResponse.json(
      { error: "Account deletion failed. The account may be the last active owner." },
      { status: 409 },
    );
  }

  const { error: completedAuditError } = await supabase.rpc("log_owner_action", {
    action_name: "account_deleted",
    target_user: userId.data,
    action_details: { role: target.role, status: target.status },
  });
  if (completedAuditError) {
    console.error("Account was deleted, but the completion audit entry could not be saved.", completedAuditError);
    return NextResponse.json(
      { error: "The account was deleted, but audit confirmation failed." },
      { status: 502 },
    );
  }

  return new NextResponse(null, { status: 204 });
}

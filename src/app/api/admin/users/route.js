import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwnerApi, readJsonBody } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const inviteSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  displayName: z.string().trim().min(1).max(80),
  role: z.enum(["owner", "editor", "contributor", "reader"]),
}).strict();

export async function GET(request) {
  const context = await requireOwnerApi(request);
  if (context.response) return context.response;

  const supabase = await createSupabaseServerClient();
  const profiles = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, role, status, created_at")
      .order("created_at", { ascending: false })
      .range(offset, offset + 999);

    if (error) {
      return NextResponse.json({ error: "Unable to load user profiles." }, { status: 502 });
    }
    profiles.push(...data);
    if (data.length < 1000) break;
  }

  const authUsers = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await context.adminClient.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      return NextResponse.json({ error: "Unable to load account email addresses." }, { status: 502 });
    }
    authUsers.push(...data.users);
    if (data.users.length < 1000) break;
  }

  const emailById = new Map(authUsers.map((user) => [user.id, user.email ?? null]));
  return NextResponse.json({
    users: profiles.map((profile) => ({
      ...profile,
      email: emailById.get(profile.id) ?? null,
    })),
  });
}

export async function POST(request) {
  const context = await requireOwnerApi(request, { mutating: true });
  if (context.response) return context.response;

  const parsedBody = await readJsonBody(request);
  if (parsedBody.response) return parsedBody.response;

  const parsedInvite = inviteSchema.safeParse(parsedBody.body);
  if (!parsedInvite.success) {
    return NextResponse.json({ error: "Provide a valid email, display name, and role." }, { status: 400 });
  }

  const { email, displayName, role } = parsedInvite.data;
  const { data: invite, error: inviteError } =
    await context.adminClient.auth.admin.inviteUserByEmail(email, {
      data: { display_name: displayName },
    });

  if (inviteError || !invite.user) {
    return NextResponse.json({ error: "Unable to invite this account." }, { status: 502 });
  }

  const supabase = await createSupabaseServerClient();
  const { error: roleError } = await supabase.rpc("admin_update_profile", {
    target_user_id: invite.user.id,
    new_role: role,
    new_status: "active",
  });

  if (roleError) {
    const { error: cleanupError } = await context.adminClient.auth.admin.deleteUser(invite.user.id);
    if (cleanupError) {
      console.error("Could not roll back an invite after role assignment failed.", cleanupError);
    }
    return NextResponse.json({ error: "Unable to assign the requested role to the invited account." }, { status: 502 });
  }

  return NextResponse.json(
    { user: { id: invite.user.id, email, displayName, role, status: "active" } },
    { status: 201 },
  );
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody, requireRoleApi } from "@/lib/auth/api";

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  username: z.string().trim().min(1).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  bio: z.string().trim().max(500),
  avatarUrl: z.string().trim().max(500).url().or(z.literal("")).optional(),
}).strict();

export async function PATCH(request) {
  const context = await requireRoleApi(request, ["owner", "editor", "contributor", "reader"], { mutating: true });
  if (context.response) return context.response;
  const parsedBody = await readJsonBody(request, { maxBytes: 4096 });
  if (parsedBody.response) return parsedBody.response;
  const parsed = profileSchema.safeParse(parsedBody.body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Provide a display name and a valid HTTPS avatar URL." }, { status: 400 });
  }
  const avatarUrl = parsed.data.avatarUrl || null;
  if (avatarUrl && new URL(avatarUrl).protocol !== "https:") {
    return NextResponse.json({ error: "Avatar URLs must use HTTPS." }, { status: 400 });
  }
  const { error } = await context.supabase
    .from("profiles")
    .update({
      full_name: parsed.data.displayName,
      username: parsed.data.username,
      bio: parsed.data.bio,
      avatar_url: avatarUrl,
    })
    .eq("id", context.principal.id);
  if (error) {
    const status = error.code === "23505" ? 409 : error.code === "23514" ? 400 : 502;
    return NextResponse.json({
      error: status === 409 ? "That username is already in use." : status === 400 ? "The profile details are invalid." : "Unable to update your profile.",
    }, { status });
  }
  return NextResponse.json({ status: "updated" });
}

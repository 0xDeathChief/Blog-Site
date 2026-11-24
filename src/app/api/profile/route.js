import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody, requireRoleApi } from "@/lib/auth/api";

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
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
    .update({ display_name: parsed.data.displayName, avatar_url: avatarUrl })
    .eq("id", context.principal.id);
  if (error) return NextResponse.json({ error: "Unable to update your profile." }, { status: 502 });
  return NextResponse.json({ status: "updated" });
}

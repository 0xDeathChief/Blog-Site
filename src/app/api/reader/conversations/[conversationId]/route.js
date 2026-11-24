import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleApi } from "@/lib/auth/api";

export async function DELETE(request, context) {
  const authorization = await requireRoleApi(request, ["owner", "editor", "contributor", "reader"], { mutating: true });
  if (authorization.response) return authorization.response;
  const { conversationId } = await context.params;
  if (!z.string().uuid().safeParse(conversationId).success) {
    return NextResponse.json({ error: "Invalid conversation ID." }, { status: 400 });
  }
  const { data, error } = await authorization.supabase
    .from("ai_conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", authorization.principal.id)
    .select("id");
  if (error) return NextResponse.json({ error: "Unable to delete this conversation." }, { status: 502 });
  if (!data?.length) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody, requireRoleApi } from "@/lib/auth/api";

const messageSchema = z.object({
  id: z.string().max(64),
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(30000),
  task: z.string().max(40).optional(),
  createdAt: z.string().datetime().optional(),
}).strict();
const conversationSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(120),
  messages: z.array(messageSchema).min(1).max(100),
}).strict().refine((value) => value.messages.reduce((total, message) => total + message.content.length, 0) <= 100_000);

export async function GET(request) {
  const context = await requireRoleApi(request, ["owner", "editor", "contributor", "reader"]);
  if (context.response) return context.response;
  const { data, error } = await context.supabase
    .from("ai_conversations")
    .select("id, title, created_at, updated_at, ai_messages(id)")
    .eq("user_id", context.principal.id)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: "Unable to load conversation history." }, { status: 502 });
  return NextResponse.json({
    conversations: data.map(({ ai_messages: messages = [], ...conversation }) => ({
      ...conversation,
      message_count: messages.length,
    })),
  });
}

export async function POST(request) {
  const context = await requireRoleApi(request, ["owner", "editor", "contributor", "reader"], { mutating: true });
  if (context.response) return context.response;
  const parsedBody = await readJsonBody(request, { maxBytes: 512 * 1024 });
  if (parsedBody.response) return parsedBody.response;
  const parsed = conversationSchema.safeParse(parsedBody.body);
  if (!parsed.success) return NextResponse.json({ error: "This conversation is too large or contains invalid messages." }, { status: 400 });

  const { data: conversationId, error } = await context.supabase.rpc("save_ai_conversation", {
    target_conversation_id: parsed.data.id ?? null,
    conversation_title: parsed.data.title,
    message_values: parsed.data.messages,
  });
  if (error) {
    const status = error.code === "P0002" ? 404 : error.code === "22023" ? 400 : error.code === "42501" ? 403 : 502;
    return NextResponse.json({
      error: status === 404 ? "Conversation not found."
        : status === 400 ? "This conversation is too large or your history limit has been reached."
          : "Unable to save this conversation.",
    }, { status });
  }
  return NextResponse.json({ id: conversationId });
}

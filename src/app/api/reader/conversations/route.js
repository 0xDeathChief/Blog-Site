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
    .select("id, title, created_at, updated_at, message_count")
    .eq("user_id", context.principal.id)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: "Unable to load conversation history." }, { status: 502 });
  return NextResponse.json({ conversations: data });
}

export async function POST(request) {
  const context = await requireRoleApi(request, ["owner", "editor", "contributor", "reader"], { mutating: true });
  if (context.response) return context.response;
  const parsedBody = await readJsonBody(request, { maxBytes: 512 * 1024 });
  if (parsedBody.response) return parsedBody.response;
  const parsed = conversationSchema.safeParse(parsedBody.body);
  if (!parsed.success) return NextResponse.json({ error: "This conversation is too large or contains invalid messages." }, { status: 400 });

  const values = {
    title: parsed.data.title,
    message_count: parsed.data.messages.length,
    messages: parsed.data.messages,
    user_id: context.principal.id,
  };
  if (!parsed.data.id) {
    const { count, error: countError } = await context.supabase
      .from("ai_conversations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.principal.id);
    if (countError) return NextResponse.json({ error: "Unable to verify your conversation limit." }, { status: 502 });
    if (count >= 100) return NextResponse.json({ error: "Conversation history is full. Delete an older conversation before starting another." }, { status: 409 });
  }
  const result = parsed.data.id
    ? await context.supabase.from("ai_conversations").update(values).eq("id", parsed.data.id).eq("user_id", context.principal.id).select("id").maybeSingle()
    : await context.supabase.from("ai_conversations").insert(values).select("id").single();
  if (result.error) return NextResponse.json({ error: "Unable to save this conversation." }, { status: 502 });
  if (!result.data) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  return NextResponse.json({ id: result.data.id });
}

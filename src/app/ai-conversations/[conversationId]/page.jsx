import Link from "next/link";
import { notFound } from "next/navigation";
import { ConversationDetail } from "@/components/portal/ReaderCollectionPage";
import DeleteConversationButton from "@/components/portal/DeleteConversationButton";
import PortalFrame from "@/components/portal/PortalFrame";
import { requireArticlePage } from "@/lib/articles/page-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AiConversationPage({ params }) {
  const { conversationId } = await params;
  const principal = await requireArticlePage(["owner", "editor", "contributor", "reader"], `/ai-conversations/${conversationId}`);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("ai_conversations")
    .select("id, title, updated_at")
    .eq("id", conversationId).eq("user_id", principal.id).maybeSingle();
  if (!data) {
    if (error) throw new Error("Unable to load this conversation.", { cause: error });
    notFound();
  }
  const { data: messages, error: messagesError } = await supabase.from("ai_messages")
    .select("id, role, content, created_at, task")
    .eq("conversation_id", data.id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (messagesError) throw new Error("Unable to load conversation messages.", { cause: messagesError });
  return (
    <PortalFrame principal={principal} area={principal.role === "owner" ? "owner" : principal.role === "editor" ? "editor" : principal.role === "contributor" ? "contributor" : "reader"} title={data.title} description={`Conversation updated ${new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.updated_at))}.`}>
      <Link className="back-link" href="/ai-conversations">← Conversation history</Link>
      <DeleteConversationButton conversationId={data.id} />
      <ConversationDetail conversation={{ ...data, messages: (messages ?? []).map((message) => ({
        ...message,
        id: String(message.id),
        createdAt: message.created_at,
      })) }} />
    </PortalFrame>
  );
}

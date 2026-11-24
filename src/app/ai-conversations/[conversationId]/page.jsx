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
    .select("id, title, messages, updated_at")
    .eq("id", conversationId).eq("user_id", principal.id).maybeSingle();
  if (!data) {
    if (error) throw new Error("Unable to load this conversation.", { cause: error });
    notFound();
  }
  return (
    <PortalFrame principal={principal} area={principal.role === "owner" ? "owner" : principal.role === "editor" ? "editor" : principal.role === "contributor" ? "contributor" : "reader"} title={data.title} description={`Conversation updated ${new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.updated_at))}.`}>
      <Link className="back-link" href="/ai-conversations">← Conversation history</Link>
      <DeleteConversationButton conversationId={data.id} />
      <ConversationDetail conversation={data} />
    </PortalFrame>
  );
}

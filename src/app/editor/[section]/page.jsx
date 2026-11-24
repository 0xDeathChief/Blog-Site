import { notFound } from "next/navigation";
import PortalFrame from "@/components/portal/PortalFrame";
import PortalArticles, { PortalRecords } from "@/components/portal/PortalArticles";
import { requireArticlePage } from "@/lib/articles/page-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const sections = {
  "pending-reviews": { title: "Pending reviews", description: "Submitted articles waiting for an editor.", statuses: ["submitted"] },
  "under-review": { title: "Under review", description: "Articles currently being reviewed by the editorial team.", statuses: ["in_review"] },
  "revision-requests": { title: "Revision requests", description: "Articles returned to contributors for changes.", statuses: ["revision_requested"] },
  "contributor-articles": { title: "Contributor articles", description: "Article submissions and publications visible to the editorial team.", statuses: null },
};

export default async function EditorSectionPage({ params }) {
  const { section } = await params;
  const principal = await requireArticlePage(["owner", "editor"], `/editor/${section}`);
  const supabase = await createSupabaseServerClient();
  const area = principal.role === "owner" ? "owner" : "editor";

  if (section === "review-history") {
    const [eventsResult, feedbackResult] = await Promise.all([
      supabase.from("article_events").select("id, action, actor_name, from_status, to_status, created_at, articles(title, slug)").order("created_at", { ascending: false }).limit(100),
      supabase.from("editorial_feedback").select("id, reviewer_name, kind, message, created_at, articles(title, slug)").order("created_at", { ascending: false }).limit(100),
    ]);
    if (eventsResult.error || feedbackResult.error) throw new Error("Unable to load review history.", { cause: eventsResult.error ?? feedbackResult.error });
    const records = [
      ...(eventsResult.data ?? []).map((item) => ({
        id: `event-${item.id}`,
        title: `${item.actor_name}: ${item.from_status ? `${item.from_status} → ${item.to_status}` : item.action}`,
        articleTitle: item.articles?.title,
        articleSlug: item.articles?.slug,
        created_at: item.created_at,
      })),
      ...(feedbackResult.data ?? []).map((item) => ({
        id: `feedback-${item.id}`,
        title: `${item.reviewer_name} · ${item.kind}`,
        message: item.message,
        articleTitle: item.articles?.title,
        articleSlug: item.articles?.slug,
        created_at: item.created_at,
      })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return <PortalFrame principal={principal} area={area} title="Review history" description="Editorial decisions and feedback, newest first."><PortalRecords records={records} empty="No review history yet." /></PortalFrame>;
  }

  const config = sections[section];
  if (!config) notFound();
  let query = supabase
    .from("articles")
    .select("id, author_id, title, slug, summary, status, reading_time_minutes, updated_at, categories(name)")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (config.statuses) query = query.in("status", config.statuses);
  const { data: articles, error } = await query;
  if (error) throw new Error(`Unable to load ${config.title.toLowerCase()}.`, { cause: error });
  const authorIds = [...new Set((articles ?? []).map((article) => article.author_id).filter(Boolean))];
  const { data: profiles, error: profileError } = authorIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", authorIds)
    : { data: [], error: null };
  if (profileError) throw new Error("Unable to load contributor names.", { cause: profileError });
  const authorNames = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
  const rows = (articles ?? []).map((article) => ({ ...article, author_name: authorNames.get(article.author_id) ?? "Former member" }));
  return <PortalFrame principal={principal} area={area} title={config.title} description={config.description}><PortalArticles articles={rows} /></PortalFrame>;
}

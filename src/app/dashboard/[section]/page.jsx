import Link from "next/link";
import { notFound } from "next/navigation";
import PortalFrame from "@/components/portal/PortalFrame";
import PortalArticles, { PortalRecords } from "@/components/portal/PortalArticles";
import ProfileSettingsForm from "@/components/profile/ProfileSettingsForm";
import { requireArticlePage } from "@/lib/articles/page-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const sectionConfig = {
  drafts: { title: "Drafts", description: "Articles that are saved privately and ready for continued editing.", statuses: ["draft"] },
  submitted: { title: "Submitted articles", description: "Submissions waiting for or currently in editorial review.", statuses: ["submitted", "in_review", "approved"] },
  published: { title: "Published articles", description: "Your work currently available to readers.", statuses: ["published"] },
};

export default async function ContributorSectionPage({ params }) {
  const { section } = await params;
  const principal = await requireArticlePage(["contributor"], `/dashboard/${section}`);
  const supabase = await createSupabaseServerClient();

  if (section === "profile") {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("display_name:full_name, avatar_url, username, bio")
      .eq("id", principal.id)
      .single();
    if (error) throw new Error("Unable to load your profile.", { cause: error });
    return (
      <PortalFrame principal={principal} area="contributor" title="Profile settings" description="Keep your author profile current.">
        <section className="portal-card"><ProfileSettingsForm displayName={profile.display_name} username={profile.username} bio={profile.bio} avatarUrl={profile.avatar_url} /></section>
      </PortalFrame>
    );
  }

  if (section === "feedback") {
    const { data: articles, error: articleError } = await supabase
      .from("articles").select("id, title, slug").eq("author_id", principal.id);
    if (articleError) throw new Error("Unable to load your articles.", { cause: articleError });
    const articleById = new Map((articles ?? []).map((article) => [article.id, article]));
    const articleIds = [...articleById.keys()];
    const { data: feedback, error } = articleIds.length
      ? await supabase      .from("article_reviews").select("id, article_id, reviewer_name, kind:status, message:feedback, created_at").in("article_id", articleIds).order("created_at", { ascending: false }).limit(100)
      : { data: [], error: null };
    if (error) throw new Error("Unable to load review feedback.", { cause: error });
    const records = (feedback ?? []).map((item) => ({
      ...item,
      title: `${item.reviewer_name} · ${item.kind.replaceAll("_", " ")}`,
      articleTitle: articleById.get(item.article_id)?.title,
      articleSlug: articleById.get(item.article_id)?.slug,
    }));
    return (
      <PortalFrame principal={principal} area="contributor" title="Review feedback" description="Editorial notes attached to your submissions.">
        <PortalRecords records={records} empty="No editorial feedback yet." />
      </PortalFrame>
    );
  }

  const config = sectionConfig[section];
  if (!config) notFound();
  const { data: articles, error } = await supabase
    .from("articles")
    .select("id, author_id, title, slug, summary:excerpt, status, reading_time_minutes:reading_time, updated_at, categories(name)")
    .eq("author_id", principal.id)
    .in("status", config.statuses)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Unable to load your ${section}.`, { cause: error });
  return (
    <PortalFrame principal={principal} area="contributor" title={config.title} description={config.description}>
      <PortalArticles articles={(articles ?? []).map((article) => ({ ...article, author_name: principal.displayName }))} />
      {section === "drafts" && (
        <p className="portal-footnote">Need a new draft? <Link href="/dashboard/articles/new">Start an article</Link>.</p>
      )}
    </PortalFrame>
  );
}

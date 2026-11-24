import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import PortalFrame from "@/components/portal/PortalFrame";
import PortalArticles, { PortalStats } from "@/components/portal/PortalArticles";
import { requireArticlePage } from "@/lib/articles/page-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Contributor overview — CipherBrief" };
export const dynamic = "force-dynamic";

export default async function ContributorOverviewPage() {
  const principal = await requireArticlePage(["contributor"], "/dashboard");
  const supabase = await createSupabaseServerClient();
  const { data: articles, error } = await supabase
    .from("articles")
    .select("id, author_id, title, slug, summary, status, reading_time_minutes, updated_at, categories(name)")
    .eq("author_id", principal.id)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Unable to load your contributor overview.", { cause: error });
  const rows = articles ?? [];

  return (
    <PortalFrame principal={principal} area="contributor" title="Your writing, in one place." description="Track drafts, submissions, feedback, and published work.">
      <PortalStats stats={[
        ["My articles", rows.length],
        ["Drafts", rows.filter((item) => item.status === "draft").length],
        ["In review", rows.filter((item) => ["submitted", "in_review"].includes(item.status)).length],
        ["Published", rows.filter((item) => item.status === "published").length],
      ]} />
      <div className="portal-quick-actions">
        <Link className="primary-button" href="/dashboard/articles/new"><FilePlus2 size={16} /> Create an article</Link>
        <Link className="secondary-button" href="/dashboard/feedback">View review feedback</Link>
      </div>
      <h2 className="portal-section-title">Recently updated</h2>
      <PortalArticles articles={rows.slice(0, 8).map((article) => ({ ...article, author_name: principal.displayName }))} />
    </PortalFrame>
  );
}

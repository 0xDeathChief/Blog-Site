import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import PortalFrame from "@/components/portal/PortalFrame";
import PortalArticles, { PortalStats } from "@/components/portal/PortalArticles";
import { requireArticlePage } from "@/lib/articles/page-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Editor overview — CipherBrief" };
export const dynamic = "force-dynamic";

export default async function EditorOverviewPage() {
  const principal = await requireArticlePage(["owner", "editor"], "/editor");
  const supabase = await createSupabaseServerClient();
  const { data: articles, error } = await supabase
    .from("articles")
    .select("id, author_id, title, slug, summary, status, reading_time_minutes, updated_at, categories(name)")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw new Error("Unable to load the editorial overview.", { cause: error });
  const allArticles = articles ?? [];
  const authorIds = [...new Set(allArticles.map((article) => article.author_id).filter(Boolean))];
  const { data: profiles, error: profileError } = authorIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", authorIds)
    : { data: [], error: null };
  if (profileError) throw new Error("Unable to load contributor names.", { cause: profileError });
  const authorNames = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
  const mapped = allArticles.map((article) => ({ ...article, author_name: authorNames.get(article.author_id) ?? "Former member" }));
  const pending = mapped.filter((article) => article.status === "submitted");

  return (
    <PortalFrame principal={principal} area={principal.role === "owner" ? "owner" : "editor"} title="Editorial review." description="Keep submissions moving through careful, timely review.">
      <PortalStats stats={[
        ["Pending", pending.length],
        ["Under review", mapped.filter((item) => item.status === "in_review").length],
        ["Revision requested", mapped.filter((item) => item.status === "revision_requested").length],
        ["Approved for owner", mapped.filter((item) => item.status === "approved").length],
      ]} />
      <div className="portal-quick-actions"><Link className="primary-button" href="/editor/pending-reviews"><ClipboardCheck size={16} /> Review submissions</Link></div>
      <h2 className="portal-section-title">Pending review</h2>
      <PortalArticles articles={pending.slice(0, 8)} empty="No submissions are waiting for review." />
    </PortalFrame>
  );
}

import { notFound } from "next/navigation";
import AdminCatalog from "@/components/admin/AdminCatalog";
import FeaturedContent from "@/components/admin/FeaturedContent";
import AdminSettings from "@/components/admin/AdminSettings";
import AdminUsers from "@/components/admin/AdminUsers";
import PortalFrame from "@/components/portal/PortalFrame";
import PortalArticles, { PortalRecords, PortalStats } from "@/components/portal/PortalArticles";
import { requireArticlePage } from "@/lib/articles/page-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const sectionTitles = {
  analytics: ["Analytics", "Account and article workflow counts."],
  users: ["User management", "Invite accounts, update access roles, deactivate, or delete accounts."],
  roles: ["Role management", "Assign platform roles to invited accounts. Only the owner can assign another owner."],
  articles: ["Article management", "All article statuses, with owner publishing controls in the article workspace."],
  reviews: ["Review management", "Editorial submissions and decisions across the publication."],
  categories: ["Category management", "Add categories, control their visibility, or remove unused topics."],
  tags: ["Tag management", "Organize published writing with useful, consistent tags."],
  featured: ["Featured content", "Choose which published article is highlighted as featured."],
  "ai-settings": ["AI settings", "Configure the Ollama model and enable or disable assistant services."],
  "website-settings": ["Website settings", "Update the site metadata and public contact address."],
  "audit-logs": ["Audit logs", "Owner-only record of administrative and account actions."],
};

export default async function AdminSectionPage({ params }) {
  const { section } = await params;
  const principal = await requireArticlePage(["owner"], `/admin/${section}`);
  const titleAndDescription = sectionTitles[section];
  if (!titleAndDescription) notFound();
  const [title, description] = titleAndDescription;
  const supabase = await createSupabaseServerClient();

  if (section === "users" || section === "roles") {
    return <PortalFrame principal={principal} area="owner" title={title} description={description}><AdminUsers currentUserId={principal.id} /></PortalFrame>;
  }
  if (section === "categories" || section === "tags") {
    return <PortalFrame principal={principal} area="owner" title={title} description={description}><AdminCatalog kind={section} /></PortalFrame>;
  }
  if (section === "ai-settings") {
    const { data, error } = await supabase.from("ai_settings").select("model_name, enabled").eq("id", 1).maybeSingle();
    if (error) throw new Error("Unable to load AI settings.", { cause: error });
    const initial = data ?? {
      model_name: process.env.OLLAMA_MODEL ?? "",
      enabled: Boolean(process.env.OLLAMA_MODEL),
    };
    return <PortalFrame principal={principal} area="owner" title={title} description={description}><AdminSettings kind="ai" initial={initial} /></PortalFrame>;
  }
  if (section === "website-settings") {
    const { data, error } = await supabase.from("site_settings").select("setting_key, setting_value").order("setting_key");
    if (error) throw new Error("Unable to load website settings.", { cause: error });
    return <PortalFrame principal={principal} area="owner" title={title} description={description}><AdminSettings kind="website" initial={data ?? []} /></PortalFrame>;
  }
  if (section === "analytics") {
    const { data, error } = await supabase.rpc("get_owner_analytics");
    if (error) throw new Error("Unable to load administrative analytics.", { cause: error });
    const counts = data?.articles_by_status ?? {};
    return <PortalFrame principal={principal} area="owner" title={title} description={description}>
      <PortalStats stats={[
        ["Accounts", data?.user_count ?? 0],
        ["All articles", data?.article_count ?? 0],
        ["Submitted", counts.submitted ?? 0],
        ["Published", counts.published ?? 0],
      ]} />
      <section className="portal-card admin-status-summary"><h2>Articles by status</h2><div>{Object.entries(counts).map(([status, count]) => <span key={status}><strong>{count}</strong>{status.replaceAll("_", " ")}</span>)}</div></section>
    </PortalFrame>;
  }
  if (section === "audit-logs") {
    const { data, error } = await supabase.from("moderation_logs")
      .select("id, actor_name, action, target_user_id, details, created_at")
      .order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error("Unable to load administrative audit logs.", { cause: error });
    const records = (data ?? []).map((item) => ({
      ...item,
      title: `${item.actor_name} · ${item.action}`,
      details: item.details,
    }));
    return <PortalFrame principal={principal} area="owner" title={title} description={description}><PortalRecords records={records} empty="No administrative events recorded yet." /></PortalFrame>;
  }

  if (section === "featured") {
    const { data: articles, error } = await supabase.from("articles")
      .select("id, author_id, title, slug, is_featured, categories(name)")
      .eq("status", "published").order("published_at", { ascending: false }).limit(200);
    if (error) throw new Error("Unable to load featured-content candidates.", { cause: error });
    const authorIds = [...new Set((articles ?? []).map((article) => article.author_id).filter(Boolean))];
    const { data: profiles, error: profileError } = authorIds.length
      ? await supabase.from("profiles").select("id, display_name").in("id", authorIds)
      : { data: [], error: null };
    if (profileError) throw new Error("Unable to load article authors.", { cause: profileError });
    const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
    return <PortalFrame principal={principal} area="owner" title={title} description={description}><FeaturedContent articles={(articles ?? []).map((article) => ({ ...article, author_name: names.get(article.author_id) ?? "Former member" }))} /></PortalFrame>;
  }

  if (section === "articles" || section === "reviews") {
    let query = supabase.from("articles")
      .select("id, author_id, title, slug, summary, status, reading_time_minutes, updated_at, categories(name)")
      .order("updated_at", { ascending: false }).limit(200);
    if (section === "reviews") query = query.in("status", ["submitted", "in_review", "revision_requested", "approved"]);
    const { data: articles, error } = await query;
    if (error) throw new Error("Unable to load administrative article records.", { cause: error });
    const authorIds = [...new Set((articles ?? []).map((article) => article.author_id).filter(Boolean))];
    const { data: profiles, error: profileError } = authorIds.length
      ? await supabase.from("profiles").select("id, display_name").in("id", authorIds)
      : { data: [], error: null };
    if (profileError) throw new Error("Unable to load article authors.", { cause: profileError });
    const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
    const rows = (articles ?? []).map((article) => ({ ...article, author_name: names.get(article.author_id) ?? "Former member" }));
    return <PortalFrame principal={principal} area="owner" title={title} description={description}><PortalArticles articles={rows} empty="No articles found." /></PortalFrame>;
  }
  notFound();
}

import Link from "next/link";
import { Settings2, Users } from "lucide-react";
import PortalFrame from "@/components/portal/PortalFrame";
import { PortalStats } from "@/components/portal/PortalArticles";
import { requireArticlePage } from "@/lib/articles/page-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Administration — MadQuill" };
export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const principal = await requireArticlePage(["owner"], "/admin");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_owner_analytics");
  if (error) throw new Error("Unable to load administrative analytics.", { cause: error });
  const counts = data?.articles_by_status ?? {};
  return (
    <PortalFrame principal={principal} area="owner" title="Platform overview." description="Manage community access, editorial workflows, and publication settings.">
      <PortalStats stats={[
        ["Accounts", data?.user_count ?? 0],
        ["Articles", data?.article_count ?? 0],
        ["Awaiting review", counts.submitted ?? 0],
        ["Published", counts.published ?? 0],
      ]} />
      <div className="portal-quick-actions"><Link className="primary-button" href="/dashboard/articles/new">+ New article</Link><Link className="secondary-button" href="/admin/reviews">Review submissions</Link>
        <Link className="secondary-button" href="/admin/users"><Users size={16} /> Manage accounts</Link>
        <Link className="secondary-button" href="/admin/website-settings"><Settings2 size={16} /> Website settings</Link>
      </div>
      <section className="portal-card admin-status-summary">
        <h2>Article workflow</h2>
        <div>{Object.entries(counts).map(([status, count]) => <span key={status}><strong>{count}</strong>{status.replaceAll("_", " ")}</span>)}</div>
      </section>
    </PortalFrame>
  );
}

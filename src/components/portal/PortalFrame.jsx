import Link from "next/link";
import PortalHeader from "@/components/portal/PortalHeader";

const navigation = {
  contributor: [
    ["Overview", "/dashboard"],
    ["My articles", "/dashboard/articles"],
    ["Drafts", "/dashboard/drafts"],
    ["Submitted", "/dashboard/submitted"],
    ["Review feedback", "/dashboard/feedback"],
    ["Published", "/dashboard/published"],
    ["AI conversations", "/ai-conversations"],
  ],
  editor: [
    ["Overview", "/editor"],
    ["Pending reviews", "/editor/pending-reviews"],
    ["Under review", "/editor/under-review"],
    ["Revision requests", "/editor/revision-requests"],
    ["Review history", "/editor/review-history"],
    ["Contributor articles", "/editor/contributor-articles"],
    ["Article workspace", "/dashboard/articles"],
    ["AI conversations", "/ai-conversations"],
  ],
  owner: [
    ["Overview", "/admin"],
    ["Analytics", "/admin/analytics"],
    ["User management", "/admin/users"],
    ["Role management", "/admin/roles"],
    ["Article management", "/admin/articles"],
    ["Review management", "/admin/reviews"],
    ["Categories", "/admin/categories"],
    ["Tags", "/admin/tags"],
    ["Featured content", "/admin/featured"],
    ["AI settings", "/admin/ai-settings"],
    ["Website settings", "/admin/website-settings"],
    ["Audit logs", "/admin/audit-logs"],
    ["AI conversations", "/ai-conversations"],
  ],
  reader: [
    ["Profile", "/profile"],
    ["Bookmarks", "/bookmarks"],
    ["Liked articles", "/likes"],
    ["Comments", "/comments"],
    ["AI conversations", "/ai-conversations"],
    ["Reading history", "/reading-history"],
  ],
};

export default function PortalFrame({ principal, area, title, description, children }) {
  const links = navigation[area] ?? [];
  return (
    <main className="portal-page">
      <div className="shell">
        <PortalHeader displayName={principal.displayName} role={principal.role} />
        <div className="portal-layout">
          <aside className="portal-sidebar">
            <span className="section-kicker">{area.toUpperCase()} WORKSPACE</span>
            <nav aria-label={`${area} navigation`}>
              {links.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}
            </nav>
          </aside>
          <section className="portal-content">
            <header className="portal-page-heading">
              <span className="section-kicker">CIPHERBRIEF · {area.toUpperCase()}</span>
              <h1>{title}</h1>
              {description && <p>{description}</p>}
            </header>
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}

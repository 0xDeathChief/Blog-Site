import PublicPage from "@/components/public/PublicPage";

export const metadata = { title: "Privacy Policy — MadQuill", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <PublicPage kicker="POLICIES" title="Privacy policy" description="Last updated November 25, 2026.">
      <article className="policy-content">
        <h2>Information we use</h2><p>MadQuill uses account details needed to authenticate you and provide role-appropriate features. Article drafts, editorial feedback, comments, bookmarks, likes, and reading history are stored to operate the service.</p>
        <h2>Cookies and security</h2><p>Supabase Authentication uses session cookies to keep you signed in. We apply server-side role checks and database access policies, but no internet service can guarantee absolute security.</p>
        <h2>Retention and your choices</h2><p>Account data remains while the account is active and may be retained in editorial or moderation records as required to operate the publication. Contact the platform owner for privacy requests; a public contact address should be configured by the site owner.</p>
      </article>
    </PublicPage>
  );
}

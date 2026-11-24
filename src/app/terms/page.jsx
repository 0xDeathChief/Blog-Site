import PublicPage from "@/components/public/PublicPage";

export const metadata = { title: "Terms and Conditions — CipherBrief", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <PublicPage kicker="POLICIES" title="Terms and conditions" description="Last updated November 25, 2026.">
      <article className="policy-content">
        <h2>Use of the publication</h2><p>Use CipherBrief lawfully and respectfully. Content is provided for education and defensive security learning; it is not permission to access systems or data without authorization.</p>
        <h2>Community contributions</h2><p>Contributors must have the right to submit their work and must avoid publishing private information, harmful instructions, or material that enables unauthorized activity. Submissions may be edited, returned for revision, rejected, or removed under editorial policy.</p>
        <h2>Accuracy and availability</h2><p>Security information changes over time. Readers should verify guidance before applying it, use authorized environments, and follow applicable laws and organizational policies. The service may change or become unavailable.</p>
        <h2>Accounts and access</h2><p>Accounts are provided by the CipherBrief owner. Keep credentials private and report suspected account misuse to the platform owner.</p>
      </article>
    </PublicPage>
  );
}

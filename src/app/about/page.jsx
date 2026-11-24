import { BookOpenCheck, ShieldCheck, Users } from "lucide-react";
import PublicPage from "@/components/public/PublicPage";

export const metadata = { title: "About CipherBrief" };

export default function AboutPage() {
  return (
    <PublicPage kicker="ABOUT US" title="Security knowledge, shared responsibly." description="CipherBrief is a community-led cybersecurity publication focused on clear explanations, careful research, and practical learning.">
      <div className="public-feature-grid">
        <article><ShieldCheck /><h2>Care before reach</h2><p>Articles move through an editorial workflow so technical details are reviewed before publication.</p></article>
        <article><BookOpenCheck /><h2>Learning for everyone</h2><p>We aim to make complicated security topics approachable without stripping away the technical meaning.</p></article>
        <article><Users /><h2>Community contribution</h2><p>Contributors share experience; editors help make each piece accurate, useful, and responsible.</p></article>
      </div>
    </PublicPage>
  );
}

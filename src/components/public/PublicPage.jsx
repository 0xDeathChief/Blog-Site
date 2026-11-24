import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

export default function PublicPage({ kicker, title, description, children }) {
  return (
    <main>
      <SiteHeader />
      <section className="public-page">
        <div className="shell">
          <header className="public-page-heading">
            {kicker && <span className="section-kicker">{kicker}</span>}
            <h1>{title}</h1>
            {description && <p>{description}</p>}
          </header>
          {children}
        </div>
      </section>
      <footer className="site-footer">
        <div className="shell footer-content">
          <Link className="brand" href="/">
            <span className="brand-mark">CB</span>
            <span>CIPHER<span>BRIEF</span></span>
          </Link>
          <p>Clear security knowledge. Shared responsibly.</p>
          <nav className="public-footer-links" aria-label="Footer">
            <Link href="/articles">Articles</Link>
            <Link href="/categories">Categories</Link>
            <Link href="/tags">Tags</Link>
            <Link href="/authors">Authors</Link>
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}

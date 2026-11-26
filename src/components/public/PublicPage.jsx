import Link from "next/link";
import SiteHeader from "@/components/layout/SiteHeader";

export default function PublicPage({ kicker, title, description, children }) {
  return (
    <main className="cb-public-shell">
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
            <span className="brand-mark"><img src="/branding/madquill-icon-v2.webp" alt="" width={36} height={36} /></span>
            <span>Mad<span>Quill</span></span>
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

import Link from "next/link";
import Image from "next/image";

export default function MadQuillPublicationFooter() {
  return <footer className="site-footer home-footer">
    <div className="shell footer-content">
      <Link className="brand" href="/" aria-label="MadQuill home">
        <span className="brand-mark"><Image unoptimized src="/branding/madquill-icon-v2.webp" alt="" width={38} height={38} /></span>
        <span>Mad<span>Quill</span></span>
      </Link>
      <p>Clear security knowledge. Shared responsibly.</p>
      <nav className="public-footer-links" aria-label="Footer">
        <Link href="/articles">Articles</Link><Link href="/trending">Trending</Link><Link href="/categories">Categories</Link><Link href="/tags">Tags</Link><Link href="/authors">Authors</Link><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link>
      </nav>
      <span className="footer-note">Community platform · Building in public</span>
    </div>
  </footer>;
}

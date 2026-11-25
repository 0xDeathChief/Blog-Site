"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Search, ShieldCheck, UserRound, X } from "lucide-react";
import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="site-header">
      <div className="shell nav-wrap">
        <Link className="brand" href="/" aria-label="MadQuill home">
          <span className="brand-mark"><img src="/branding/madquill-icon.png" alt="" width={36} height={36} /></span>
          <span>Mad<span>Quill</span></span>
        </Link>
        <nav className={menuOpen ? "nav-links open" : "nav-links"} aria-label="Main navigation">
          <Link href="/" aria-current={pathname === "/" ? "page" : undefined} onClick={() => setMenuOpen(false)}>Home</Link>
          <Link href="/articles" aria-current={pathname === "/articles" ? "page" : undefined} onClick={() => setMenuOpen(false)}>Discover</Link>
          <Link href="/categories" aria-current={pathname.startsWith("/categories") ? "page" : undefined} onClick={() => setMenuOpen(false)}>Topics</Link>
          <Link href="/articles?sort=popularity" onClick={() => setMenuOpen(false)}>Trending</Link>
          <Link className="cb-mobile-write" href="/dashboard/articles/new" onClick={() => setMenuOpen(false)}>Write a story</Link>
          <Link className="mobile-contributor-link" href="/sign-in" onClick={() => setMenuOpen(false)}>Contributor sign in</Link>
        </nav>
        <div className="nav-actions">
          <Link className="cb-write-link" href="/dashboard/articles/new">Write a story</Link>
          <Link className="icon-button" href="/search" aria-label="Search articles">
            <Search size={19} />
          </Link>
          <Link className="icon-button" href="/profile" aria-label="Your profile">
            <UserRound size={18} />
          </Link>
          <ThemeToggle />
          <Link className="btn btn-outline signin-button contribute-link" href="/sign-in">Sign in</Link>
          <button
            className="menu-button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </div>
    </header>
  );
}

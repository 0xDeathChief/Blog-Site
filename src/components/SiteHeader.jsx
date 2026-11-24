"use client";

import { useState } from "react";
import { Menu, Search, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="shell nav-wrap">
        <Link className="brand" href="/" aria-label="CipherBrief home">
          <span className="brand-mark"><ShieldCheck size={17} /></span>
          <span>CIPHER<span>BRIEF</span></span>
        </Link>
        <nav className={menuOpen ? "nav-links open" : "nav-links"} aria-label="Main navigation">
          <Link href="/#latest" onClick={() => setMenuOpen(false)}>Latest</Link>
          <Link href="/#topics" onClick={() => setMenuOpen(false)}>Topics</Link>
          <Link href="/#learn" onClick={() => setMenuOpen(false)}>Learning</Link>
          <Link href="/#contribute" onClick={() => setMenuOpen(false)}>Community</Link>
          <Link className="mobile-contributor-link" href="/sign-in" onClick={() => setMenuOpen(false)}>Contributor sign in</Link>
        </nav>
        <div className="nav-actions">
          <Link className="icon-button" href="/#article-search" aria-label="Search articles">
            <Search size={19} />
          </Link>
          <ThemeToggle />
          <Link className="btn btn-outline signin-button contribute-link" href="/sign-in">Contributor access</Link>
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

"use client";

import { useState } from "react";
import { Menu, Search, ShieldCheck, UserRound, X } from "lucide-react";
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
          <Link href="/articles" onClick={() => setMenuOpen(false)}>Articles</Link>
          <Link href="/categories" onClick={() => setMenuOpen(false)}>Categories</Link>
          <Link href="/authors" onClick={() => setMenuOpen(false)}>Authors</Link>
          <Link href="/learning-assistant" onClick={() => setMenuOpen(false)}>Learning assistant</Link>
          <Link href="/about" onClick={() => setMenuOpen(false)}>About</Link>
          <Link className="mobile-contributor-link" href="/sign-in" onClick={() => setMenuOpen(false)}>Contributor sign in</Link>
        </nav>
        <div className="nav-actions">
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

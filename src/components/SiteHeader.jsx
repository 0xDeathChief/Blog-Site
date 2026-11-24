"use client";

import { useState } from "react";
import { Menu, Search, ShieldCheck, X } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="shell nav-wrap">
        <a className="brand" href="#" aria-label="CipherBrief home">
          <span className="brand-mark"><ShieldCheck size={17} /></span>
          <span>CIPHER<span>BRIEF</span></span>
        </a>
        <nav className={menuOpen ? "nav-links open" : "nav-links"} aria-label="Main navigation">
          <a href="#latest" onClick={() => setMenuOpen(false)}>Latest</a>
          <a href="#topics" onClick={() => setMenuOpen(false)}>Topics</a>
          <a href="#learn" onClick={() => setMenuOpen(false)}>Learning</a>
          <a href="#contribute" onClick={() => setMenuOpen(false)}>Community</a>
        </nav>
        <div className="nav-actions">
          <a className="icon-button" href="#article-search" aria-label="Search articles">
            <Search size={19} />
          </a>
          <ThemeToggle />
          <a className="btn btn-outline signin-button contribute-link" href="#contribute">Contribute</a>
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

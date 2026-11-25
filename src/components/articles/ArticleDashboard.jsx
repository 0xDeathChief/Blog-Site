"use client";

import Link from "next/link";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, LogOut, Search, ShieldCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function ArticleDashboard({ role, displayName, articles }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const canCreate = role === "owner" || role === "contributor";
  const filteredArticles = articles.filter((article) => {
    const text = `${article.title} ${article.author_name} ${article.status} ${article.categories?.name ?? ""}`.toLowerCase();
    return text.includes(query.toLowerCase());
  });
  const awaitingReview = articles.filter((article) => ["submitted", "in_review"].includes(article.status)).length;
  const published = articles.filter((article) => article.status === "published").length;

  async function signOut() {
    setSigningOut(true);
    setError("");
    try {
      const { error: signOutError } = await createSupabaseBrowserClient().auth.signOut();
      if (signOutError) throw signOutError;
      router.replace("/sign-in");
      router.refresh();
    } catch {
      setError("Unable to sign out right now. Please try again.");
      setSigningOut(false);
    }
  }

  return (
    <main className="article-management-page">
      <div className="shell">
        <header className="management-header">
          <Link className="brand" href="/">
            <span className="brand-mark"><img src="/branding/madquill-icon.png" alt="" width={36} height={36} /></span>
            <span>Mad<span>Quill</span></span>
          </Link>
          <div className="management-account">
            <ThemeToggle />
            <span>{displayName} <small>{role}</small></span>
            <button type="button" className="signout-button" onClick={signOut} disabled={signingOut}>
              <LogOut size={15} /> {signingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </header>
        <div className="dashboard-heading">
          <div>
            <span className="section-kicker">MADQUILL · {role.toUpperCase()} WORKSPACE</span>
            <h1>Article management</h1>
            <p>Create, revise, and review security writing through a clear editorial process.</p>
          </div>
          {canCreate && (
            <Link className="primary-button" href="/dashboard/articles/new">
              <FilePlus2 size={17} /> New article
            </Link>
          )}
        </div>

        <section className="article-stats" aria-label="Article overview">
          <article><span>Visible articles</span><strong>{articles.length}</strong></article>
          <article><span>Awaiting review</span><strong>{awaitingReview}</strong></article>
          <article><span>Published</span><strong>{published}</strong></article>
        </section>

        {error && <p className="workspace-alert workspace-alert-error" role="alert">{error}</p>}

        <section className="workspace-card article-list-card">
          <div className="list-heading">
            <div><h2>All articles</h2><p>{role === "contributor" ? "Your drafts and submissions" : "Editorial queue and published work"}</p></div>
            <label className="article-list-search">
              <Search size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title or status" aria-label="Search articles" />
            </label>
          </div>
          {filteredArticles.length ? (
            <div className="article-table-wrap">
              <table className="article-table">
                <thead><tr><th>Article</th><th>Author</th><th>Status</th><th>Difficulty</th><th>Updated</th><th /></tr></thead>
                <tbody>
                  {filteredArticles.map((article) => (
                    <tr key={article.id}>
                      <td><Link className="article-table-title" href={`/dashboard/articles/${article.id}`}>{article.title}</Link><small>{article.categories?.name ?? "Uncategorized"} · {article.reading_time_minutes} min read</small></td>
                      <td>{article.author_name}</td>
                      <td><span className={`status-pill status-${article.status}`}>{article.status.replaceAll("_", " ")}</span>{article.status==="published"&&<Link className="cb-public-article-link" href={`/articles/${article.slug}`} target="_blank" rel="noopener noreferrer">View live ↗</Link>}</td>
                      <td>{capitalize(article.difficulty)}</td>
                      <td>{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(article.updated_at))}</td>
                      <td><Link className="row-action" href={`/dashboard/articles/${article.id}`}>Open</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state article-list-empty">
              <FilePlus2 size={24} />
              <strong>{query ? "No matching articles" : "No articles yet"}</strong>
              <p>{query ? "Try a different title, author, or status." : "Create a draft to start the editorial workflow."}</p>
              {canCreate && !query && <Link className="secondary-button" href="/dashboard/articles/new">Write your first article</Link>}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Search, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function ArticleExplorer({ articles }) {
  const [query, setQuery] = useState("");
  const filteredArticles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return articles;

    return articles.filter((article) =>
      `${article.title} ${article.excerpt} ${article.category} ${article.author}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [articles, query]);

  return (
    <section className="latest-section" id="latest">
      <div className="shell">
        <div className="section-heading">
          <div>
            <span className="section-kicker">THE BRIEF</span>
            <h2 id="topics">Latest intelligence</h2>
          </div>
          <Link className="all-articles-link" href="/articles">Browse all articles <ArrowRight size={15} /></Link>
          <label className="article-search">
            <Search size={17} aria-hidden="true" />
            <input
              id="article-search"
              className="input input-bordered"
              type="search"
              placeholder="Search stories"
              aria-label="Search articles"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>

        {filteredArticles.length > 0 ? (
          <div className="article-grid">
            {filteredArticles.map((article) => (
              <Link className="article-card" href={`/articles/${article.slug}`} key={article.slug}>
                <div className={`article-art ${article.accent}`}>
                  {article.coverUrl ? (
                    <Image className="article-cover" src={article.coverUrl} alt="" width={720} height={360} unoptimized />
                  ) : (
                    <>
                      <div className="art-grid" />
                      <div className="art-shield"><ShieldCheck size={44} /></div>
                    </>
                  )}
                  <span>{article.category}</span>
                </div>
                <div className="article-body">
                  <h3>{article.title}</h3>
                  <p>{article.excerpt}</p>
                  <div className="card-foot">
                    <span>By {article.author}</span>
                    <span>{article.date} · {article.read}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state" role="status">
            <Search size={20} aria-hidden="true" />
            {articles.length ? (
              <>
                <strong>No articles match “{query}”.</strong>
                <p>Try a different title, topic, or author.</p>
                <button className="btn btn-ghost" type="button" onClick={() => setQuery("")}>
                  Clear search <ArrowRight size={15} />
                </button>
              </>
            ) : (
              <>
                <strong>No published articles yet.</strong>
                <p>Approved community research will appear here after publication.</p>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

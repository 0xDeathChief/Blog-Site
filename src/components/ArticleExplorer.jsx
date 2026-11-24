"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Search, ShieldCheck } from "lucide-react";

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
              <article className="article-card" key={article.title}>
                <div className={`article-art ${article.accent}`}>
                  <div className="art-grid" />
                  <div className="art-shield"><ShieldCheck size={44} /></div>
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
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state" role="status">
            <Search size={20} aria-hidden="true" />
            <strong>No articles match “{query}”.</strong>
            <p>Try a different title, topic, or author.</p>
            <button className="btn btn-ghost" type="button" onClick={() => setQuery("")}>
              Clear search <ArrowRight size={15} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

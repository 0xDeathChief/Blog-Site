"use client";

import Link from "next/link";
import { useState } from "react";

export default function FeaturedContent({ articles }) {
  const [items, setItems] = useState(articles);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function toggle(article) {
    setBusyId(article.id);
    setError("");
    try {
      const response = await fetch("/api/admin/featured", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: article.id, featured: !article.is_featured }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to update featured content.");
      setItems((current) => current.map((item) => item.id === article.id ? { ...item, is_featured: !item.is_featured } : item));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="portal-card featured-admin-list">
      {error && <p className="form-error" role="alert">{error}</p>}
      {items.length ? items.map((article) => (
        <article key={article.id}>
          <div><Link href={`/articles/${article.slug}`}>{article.title}</Link><small>{article.categories?.name ?? "Uncategorized"} · {article.author_name}</small></div>
          <button type="button" className={article.is_featured ? "secondary-button" : "primary-button"} disabled={busyId === article.id} onClick={() => toggle(article)}>{article.is_featured ? "Remove featured" : "Feature article"}</button>
        </article>
      )) : <p>No published articles to feature yet.</p>}
    </section>
  );
}

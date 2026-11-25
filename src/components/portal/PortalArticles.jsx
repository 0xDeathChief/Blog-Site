"use client";
import Link from "next/link";
import {useState} from "react";

export default function PortalArticles({ articles, empty = "No articles in this view." }) {
  const [search,setSearch]=useState("");const [status,setStatus]=useState("");
  const visible=articles.filter(a=>(!status||a.status===status)&&`${a.title} ${a.author_name??""}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <section className="portal-card portal-table-card">
      <div className="cb-table-tools"><input aria-label="Search articles" placeholder="Search title or author…" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Filter status" value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option>{[...new Set(articles.map(a=>a.status))].map(s=><option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}</select><small>{visible.length} of {articles.length} articles loaded</small></div>
      {visible.length ? (
        <div className="portal-table-scroll">
          <table className="portal-table">
            <thead><tr><th>Article</th><th>Author</th><th>Status</th><th>Updated</th><th /></tr></thead>
            <tbody>
              {visible.map((article) => (
                <tr key={article.id}>
                  <td><Link href={`/dashboard/articles/${article.id}`}>{article.title}</Link><small>{article.categories?.name ?? "Uncategorized"} · {article.reading_time_minutes} min read</small></td>
                  <td>{article.author_name ?? "You"}</td>
                  <td><span className={`status-pill status-${article.status}`}>{article.status.replaceAll("_", " ")}</span>{article.status==="published"&&<Link className="cb-public-article-link" href={`/articles/${article.slug}`} target="_blank" rel="noopener noreferrer">View live ↗</Link>}</td>
                  <td>{formatDate(article.updated_at)}</td>
                  <td><Link className="row-action" href={`/dashboard/articles/${article.id}`}>{["submitted","in_review","approved"].includes(article.status) ? "Open review →" : "Open article →"}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="empty-state"><strong>{empty}</strong><p>Articles that match this workflow will appear here.</p></div>}
    </section>
  );
}

export function PortalStats({ stats }) {
  return <section className="portal-stats">{stats.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</section>;
}

export function PortalRecords({ records, empty = "No records yet." }) {
  return (
    <section className="portal-card portal-record-list">
      {records.length ? records.map((item) => (
        <article key={item.id}>
          <div><strong>{item.title ?? item.action ?? item.kind ?? "Activity"}</strong>{item.articleTitle && <Link href={`/articles/${item.articleSlug}`}>{item.articleTitle}</Link>}</div>
          {item.message && <p>{item.message}</p>}
          {item.details && <p>{JSON.stringify(item.details)}</p>}
          <time dateTime={item.created_at}>{formatDate(item.created_at)}</time>
        </article>
      )) : <div className="empty-state"><strong>{empty}</strong></div>}
    </section>
  );
}

function formatDate(value) {
  return value
    ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "—";
}

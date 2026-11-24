import Image from "next/image";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export default function ArticleCards({ articles, emptyMessage = "No published articles found." }) {
  if (!articles.length) {
    return <div className="empty-state public-empty-state"><ShieldCheck size={23} /><strong>{emptyMessage}</strong><p>Published community writing will appear here.</p></div>;
  }

  return (
    <div className="article-grid public-article-grid">
      {articles.map((article) => (
        <Link className="article-card" href={`/articles/${article.slug}`} key={article.id}>
          <div className="article-art violet">
            {article.coverUrl
              ? <Image className="article-cover" src={article.coverUrl} alt="" width={720} height={360} unoptimized />
              : <><div className="art-grid" /><div className="art-shield"><ShieldCheck size={42} /></div></>}
            <span>{article.category ?? article.categories?.name ?? "Cybersecurity"}</span>
          </div>
          <div className="article-body">
            <h2>{article.title}</h2>
            <p>{article.summary}</p>
            <div className="card-foot">
              <span>By {article.author ?? "CipherBrief"}</span>
              <span>{formatDate(article.published_at)} · {article.reading_time_minutes} min</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function formatDate(value) {
  if (!value) return "Recently";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

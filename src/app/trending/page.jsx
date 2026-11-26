import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import SiteHeader from "@/components/layout/SiteHeader";
import { getPublishedArticlePage } from "@/lib/articles/public";
import PublicationFooter from "@/components/public/MadQuillPublicationFooter";

export const metadata = {
  title: "Trending | MadQuill",
  description: "Explore MadQuill stories ranked by recent reader engagement.",
  alternates: { canonical: "/trending" },
};
export const revalidate = 60;

function count(value, noun) {
  const n = Math.max(0, Number(value) || 0);
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

export default async function TrendingPage({ searchParams }) {
  const params = await searchParams;
  const requested = Number(typeof params?.page === "string" ? params.page : 1);
  const pageNumber = Number.isSafeInteger(requested) && requested > 0 ? Math.min(requested, 10000) : 1;
  const result = await getPublishedArticlePage({ sort: "popularity", page: pageNumber });
  const { articles, page, pageSize, totalPages } = result;
  const href = n => n === 1 ? "/trending" : `/trending?page=${n}`;
  return (
    <main className="mq-page">
      <SiteHeader />
      <section className="mq-page-content" aria-labelledby="mq-trending-heading">
        <div className="mq-page-heading">
          <span className="section-kicker">READER FAVORITES</span>
          <h1 id="mq-trending-heading">Trending stories</h1>
          <p>Explore published stories ranked by recent reader engagement. Discover what the community is reading and discussing.</p>
        </div>
        {articles.length ? (
          <div className="popular-article-list">
            {articles.map((article, index) => (
              <Link key={article.id} className="popular-article-row" href={`/articles/${article.slug}`}>
                <span className="popular-rank">{String((page - 1) * pageSize + index + 1).padStart(2, "0")}</span>
                <span className="popular-article-copy">
                  <span className="home-topic-label">{article.category}</span>
                  <strong>{article.title}</strong>
                  <span className="popular-article-summary">{article.summary}</span>
                </span>
                <span className="popular-article-meta">
                  <span>{count(article.view_count, "view")} · {count(article.comment_count, "comment")} · {count(article.likeCount, "like")}</span>
                  <span>{article.reading_time_minutes} min read</span>
                </span>
                <ArrowRight className="popular-arrow" size={18} aria-hidden="true" />
              </Link>
            ))}
          </div>
        ) : <div className="home-soft-empty"><Sparkles size={20} /><p>Trending stories will appear as content is published and readers engage with it.</p><Link href="/articles">Explore articles</Link></div>}
        {totalPages > 1 && <nav className="mq-pagination" aria-label="Trending pages">
          {page > 1 && <Link className="secondary-button" href={href(page - 1)}>Previous</Link>}
          <span>Page {page} of {totalPages}</span>
          {page < totalPages && <Link className="secondary-button" href={href(page + 1)}>Next</Link>}
        </nav>}
      </section>
      <PublicationFooter />
    </main>
  );
}

import { ArrowRight, Search, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function ArticleExplorer({ articles }) {
  return (
    <section className="latest-section" id="latest">
      <div className="shell">
        <div className="section-heading">
          <div>
            <span className="section-kicker">THE BRIEF</span>
            <h2 id="topics">Latest intelligence</h2>
          </div>
          <Link className="all-articles-link" href="/articles">Browse all articles <ArrowRight size={15} /></Link>
          <form className="article-search" action="/search" method="get">
            <Search size={17} aria-hidden="true" />
            <input
              id="article-search"
              type="search"
              name="q"
              maxLength={100}
              placeholder="Search stories"
              aria-label="Search articles"
            />
            <button type="submit" aria-label="Submit article search"><ArrowRight size={15} /></button>
          </form>
        </div>

        {articles.length > 0 ? (
          <div className="article-grid">
            {articles.map((article) => (
              <Link className="article-card" href={`/articles/${article.slug}`} key={article.slug}>
                <div className={`article-art ${article.accent}`}>
                  {article.coverUrl ? (
                    <Image
                      className="article-cover"
                      src={article.coverUrl}
                      alt=""
                      width={720}
                      height={360}
                      sizes="(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 33vw"
                    />
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
          <div className="empty-state">
            <Search size={20} aria-hidden="true" />
            <strong>No published articles yet.</strong>
            <p>Approved community research will appear here after publication.</p>
          </div>
        )}
      </div>
    </section>
  );
}

import {
  ArrowRight,
  Compass,
  FileCheck2,
  Mail,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import ArticleExplorer from "@/components/public/ArticleExplorer";
import SiteHeader from "@/components/layout/SiteHeader";
import { getPublicAuthors, getPublicCategories, getPublishedArticlePage } from "@/lib/articles/public";
import { createSupabasePublicClient } from "@/lib/supabase/public";

export const revalidate = 60;
export const metadata = { alternates: { canonical: "/" } };

export default async function Home() {
  const [articles, manualFeatured, popularArticles, categories, contributors] = await Promise.all([
    getLatestArticles(),
    getManualFeatured(),
    getPopularArticles(),
    getPublicCategories(),
    getPublicAuthors(),
  ]);
  const featuredArticle = manualFeatured ?? (popularArticles[0] ? {...popularArticles[0], readingTime:popularArticles[0].reading_time_minutes} : null);
  const featuredCategories = categories.slice(0, 6);
  const featuredContributors = contributors.slice(0, 3);

  return (
    <main>
      <SiteHeader />

      <section className="hero home-hero">
        <div className="shell hero-grid home-hero-grid">
          <div className="hero-copy home-hero-copy">
            <div className="eyebrow"><span className="live-dot" /> Independent security publication · Community-led</div>
            <h1>Knowledge for a <em>safer digital world.</em></h1>
            <p>
              Your community-driven destination for cybersecurity knowledge,
              research, practical tutorials, and security insights.
            </p>
            <form className="cb-home-search" action="/search" method="get"><label className="cb-sr-only" htmlFor="cb-hero-search">Search articles</label><input id="cb-hero-search" name="q" type="search" maxLength={100} placeholder="Search articles, topics, keywords…"/><button className="primary-button" type="submit">Search <ArrowRight size={16}/></button></form>
            <div className="hero-actions home-hero-actions">
              <Link className="primary-button" href="/articles">Explore articles <ArrowRight size={17} /></Link>
            </div>
            <div className="home-hero-note"><ShieldCheck size={15} /> Reviewed by editors. Shared by practitioners.</div>
          </div>

          <article className="featured-card home-featured-card">
            <div className="featured-meta">
              <span>{featuredArticle ? (featuredArticle.is_featured ? "EDITOR'S PICK" : "TRENDING STORY") : "OUR MISSION"}</span>
              <span className="severity"><i /> {featuredArticle ? "Featured research" : "Community-led"}</span>
            </div>
            <div className="featured-visual">
              {featuredArticle?.coverUrl ? (
                <Image
                  className="featured-cover"
                  src={featuredArticle.coverUrl} unoptimized
                  alt=""
                  fill
                  sizes="(max-width: 900px) 100vw, 55vw"
                  priority
                />
              ) : (
                <div className="home-feature-art" aria-hidden="true">
                  <div className="home-orbit orbit-outer" />
                  <div className="home-orbit orbit-middle" />
                  <div className="home-orbit orbit-inner" />
                  <div className="home-orbit-core"><ShieldCheck size={38} /></div>
                  <span className="orbit-label orbit-label-top">RESEARCH</span>
                  <span className="orbit-label orbit-label-bottom">DEFENSE</span>
                </div>
              )}
              <span className="home-feature-grid" aria-hidden="true" />
            </div>
            <div className="featured-content home-featured-content">
              <div className="article-category">{featuredArticle?.category ?? "LEARN · RESEARCH · SHARE"}</div>
              <h2>{featuredArticle
                ? <Link href={`/articles/${featuredArticle.slug}`}>{featuredArticle.title}</Link>
                : "Security knowledge, shared responsibly."}</h2>
              <p>{featuredArticle?.summary ?? "Explore practical cybersecurity writing, reviewed by editors and published with care."}</p>
              <div className="article-foot">
                <div className="author-avatar"><ShieldCheck size={16} /></div>
                <span>
                  <strong>{featuredArticle?.author ?? "MadQuill community"}</strong>
                  <small>{featuredArticle ? `${featuredArticle.readingTime} min read` : "Independent security publication"}</small>
                </span>
                {featuredArticle && (
                  <Link className="featured-read-link" href={`/articles/${featuredArticle.slug}`} aria-label={`Read ${featuredArticle.title}`}>
                    Read story <ArrowRight size={15} />
                  </Link>
                )}
              </div>
            </div>
          </article>
        </div>
      </section>


      <section className="home-popular-section" aria-labelledby="popular-heading">
        <div className="shell">
          <div className="home-section-heading">
            <div>
              <span className="section-kicker">READER FAVORITES</span>
              <h2 id="popular-heading">Trending stories</h2>
              <p>Stories with the most reader engagement in the past 30 days.</p>
            </div>
            <Link className="all-articles-link" href="/articles">Explore the archive <ArrowRight size={15} /></Link>
          </div>
          {popularArticles.length ? (
            <div className="popular-article-list">
              {popularArticles.map((article, index) => (
                <Link className="popular-article-row" href={`/articles/${article.slug}`} key={article.id}>
                  <span className="popular-rank">{String(index + 1).padStart(2, "0")}</span>
                  <span className="popular-article-copy">
                    <span className="home-topic-label">{article.category}</span>
                    <strong>{article.title}</strong>
                    <span className="popular-article-summary">{article.summary}</span>
                  </span>
                  <span className="popular-article-meta">
                    <span>{article.view_count ?? 0} views · {article.comment_count ?? 0} comments · {article.likeCount} likes</span>
                    <span>{article.reading_time_minutes} min read</span>
                  </span>
                  <ArrowRight className="popular-arrow" size={18} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="home-soft-empty">
              <Sparkles size={18} />
              <p>Reader favorites will appear here as the community discovers and appreciates more articles.</p>
            </div>
          )}
        </div>
      </section>

      <ArticleExplorer articles={articles} />

      <section className="home-topics-section" aria-labelledby="topics-heading">
        <div className="shell">
          <div className="home-section-heading">
            <div>
              <span className="section-kicker">EXPLORE BY SUBJECT</span>
              <h2 id="topics-heading">Find your next topic</h2>
              <p>Follow a question, explore a field, or start with the fundamentals.</p>
            </div>
            <Link className="all-articles-link" href="/categories">All categories <ArrowRight size={15} /></Link>
          </div>
          {featuredCategories.length ? (
            <div className="home-topic-grid">
              {featuredCategories.map((category, index) => (
                <Link className={`home-topic-card topic-tone-${index % 4}`} href={`/categories/${category.slug}`} key={category.id}>
                  <span className="home-topic-icon"><Compass size={18} /></span>
                  <span className="home-topic-label">TOPIC {String(index + 1).padStart(2, "0")}</span>
                  <strong>{category.name}</strong>
                  <span className="home-topic-count">{category.articleCount} {category.articleCount === 1 ? "article" : "articles"} <ArrowRight size={14} /></span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="home-soft-empty">
              <Compass size={18} />
              <p>Cybersecurity topics are being organized. Browse the article archive in the meantime.</p>
            </div>
          )}
        </div>
      </section>

      <section className="home-beginner-section" aria-labelledby="beginner-heading">
        <div className="shell home-beginner-layout">
          <div className="home-beginner-intro">
            <span className="section-kicker">A CLEAR PLACE TO BEGIN</span>
            <h2 id="beginner-heading">Build security knowledge, one idea at a time.</h2>
            <p>New to cybersecurity? Start with a question, learn the language, and connect concepts to practical defensive work.</p>
            <Link className="primary-button" href="/articles">Browse learning resources <ArrowRight size={16} /></Link>
          </div>
          <div className="home-beginner-steps">
            <article>
              <span>01</span>
              <div><h3>Start with the foundations</h3><p>Explore core concepts and understand the vocabulary behind security.</p></div>
            </article>
            <article>
              <span>02</span>
              <div><h3>Learn through examples</h3><p>Read approachable tutorials with commands, code, and practical context.</p></div>
            </article>
            <article>
              <span>03</span>
              <div><h3>Practice responsibly</h3><p>Build skills in authorized labs and focus on strengthening defenses.</p></div>
            </article>
          </div>
        </div>
      </section>

      <section className="home-community-section" id="community" aria-labelledby="contributors-heading">
        <div className="shell">
          <div className="home-section-heading">
            <div>
              <span className="section-kicker">PEOPLE BEHIND THE BRIEF</span>
              <h2 id="contributors-heading">Knowledge is stronger when shared.</h2>
              <p>Meet the contributors whose published work helps the community learn.</p>
            </div>
            <Link className="all-articles-link" href="/authors">Meet all authors <ArrowRight size={15} /></Link>
          </div>
          {featuredContributors.length ? (
            <div className="home-contributor-grid">
              {featuredContributors.map((contributor) => (
                <Link className="home-contributor-card" href={`/authors/${contributor.author_id}`} key={contributor.author_id}>
                  <span className="home-contributor-avatar">{contributor.full_name?.charAt(0)?.toUpperCase() ?? "C"}</span>
                  <span className="home-contributor-info">
                    <strong>{contributor.full_name}</strong>
                    <span>{contributor.article_count} published {contributor.article_count === 1 ? "article" : "articles"}</span>
                  </span>
                  <ArrowRight size={17} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="home-soft-empty">
              <Users size={18} />
              <p>Community authors will be introduced here as their work is published.</p>
            </div>
          )}
          <div className="home-community-cta">
            <span><Users size={17} /> Have a useful security lesson to share?</span>
            <Link href="/sign-in">Contribute to MadQuill <ArrowRight size={15} /></Link>
          </div>
        </div>
      </section>

      <section className="home-newsletter-section" aria-labelledby="newsletter-heading">
        <div className="shell home-newsletter-card">
          <div className="home-newsletter-icon"><Mail size={21} /></div>
          <div>
            <span className="section-kicker">THE MADQUILL NEWSLETTER</span>
            <h2 id="newsletter-heading">A thoughtful briefing is on the way.</h2>
            <p>Email subscriptions are not enabled yet. No address is collected here; explore the latest community writing instead.</p>
          </div>
          <Link className="newsletter-link" href="/articles">Browse articles <ArrowRight size={16} /></Link>
        </div>
      </section>

      <section className="community-section home-workflow-section" id="contribute">
        <div className="shell">
          <div className="community-heading">
            <span className="section-kicker">A COMMUNITY, NOT A CONTENT MILL</span>
            <h2>Good security writing is a team effort.</h2>
            <p>Contributors bring the ideas. Editors help make them clear, accurate, and useful to the people who need them.</p>
          </div>
          <div className="workflow">
            <article className="workflow-step">
              <span className="step-number">01</span>
              <div className="workflow-icon"><Users size={20} /></div>
              <h3>Contribute</h3>
              <p>Share a practical, well-sourced article with the community.</p>
            </article>
            <article className="workflow-step">
              <span className="step-number">02</span>
              <div className="workflow-icon"><FileCheck2 size={20} /></div>
              <h3>Editorial review</h3>
              <p>Editors review accuracy, clarity, safety, and usefulness for learners.</p>
            </article>
            <article className="workflow-step">
              <span className="step-number">03</span>
              <div className="workflow-icon"><ShieldCheck size={20} /></div>
              <h3>Publish together</h3>
              <p>Approved work is published with attribution and room to improve.</p>
            </article>
          </div>
          <div className="roles-note">
            <strong>Clear roles. Careful access.</strong>
            <span>Contributors manage drafts, editors review submissions, and owners make final publishing decisions.</span>
          </div>
        </div>
      </section>

      <footer className="site-footer home-footer">
        <div className="shell footer-content">
          <Link className="brand" href="/" aria-label="MadQuill home">
            <span className="brand-mark"><img src="/branding/madquill-icon.png" alt="" width={36} height={36} /></span>
            <span>Mad<span>Quill</span></span>
          </Link>
          <p>Clear security knowledge. Shared responsibly.</p>
          <nav className="public-footer-links" aria-label="Footer">
            <Link href="/articles">Articles</Link>
            <Link href="/categories">Categories</Link>
            <Link href="/tags">Tags</Link>
            <Link href="/authors">Authors</Link>
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </nav>
          <span className="footer-note">Community platform · Building in public</span>
        </div>
      </footer>
    </main>
  );
}

async function getLatestArticles() {
  const {articles} = await getPublishedArticlePage({sort:"newest",page:1});
  return articles.slice(0,6).map((article,index)=>({ ...article,
    excerpt:article.summary,date:new Intl.DateTimeFormat("en",{month:"short",day:"numeric"}).format(new Date(article.published_at)),
    read:`${article.reading_time_minutes} min`,accent:["violet","cyan","orange"][index%3]
  }));
}

const getManualFeatured = unstable_cache(async () => {
  if (!hasSupabaseConfiguration()) return null;
  const supabase=createSupabasePublicClient();
  const {data:article,error}=await supabase.from("articles").select("id,author_id,title,slug,summary:excerpt,reading_time_minutes:reading_time,cover_image_path:cover_image,categories(name),is_featured").eq("status","published").eq("is_featured",true).order("published_at",{ascending:false}).limit(1).maybeSingle();
  if(error)throw new Error("Unable to load featured article",{cause:error});
  if(!article)return null;
  const {data:authors}=await supabase.rpc("get_published_article_authors",{article_ids:[article.id]});
  return {...article,category:article.categories?.name??"Cybersecurity",author:authors?.[0]?.author_name??"Former member",readingTime:article.reading_time_minutes,coverUrl:article.cover_image_path?`/api/article-media/${article.cover_image_path}`:null};
},["homepage-manual-featured-v2"],{revalidate:60,tags:["published-content"]});

async function getPopularArticles(){
  const {articles}=await getPublishedArticlePage({sort:"popularity",page:1});
  return articles.slice(0,3);
}

function hasSupabaseConfiguration() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL
    && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

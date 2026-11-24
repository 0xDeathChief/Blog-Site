import {
  ArrowRight,
  BookOpen,
  Bot,
  Compass,
  FileCheck2,
  Languages,
  Mail,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import ArticleExplorer from "@/components/ArticleExplorer";
import SiteHeader from "@/components/SiteHeader";
import { getPublicAuthors, getPublicCategories } from "@/lib/articles/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function Home() {
  const [articles, featuredArticle, popularArticles, categories, contributors] = await Promise.all([
    getLatestArticles(),
    getFeaturedArticle(),
    getPopularArticles(),
    getPublicCategories(),
    getPublicAuthors(),
  ]);
  const featuredCategories = categories.slice(0, 6);
  const featuredContributors = contributors.slice(0, 3);

  return (
    <main>
      <SiteHeader />

      <section className="hero home-hero">
        <div className="shell hero-grid home-hero-grid">
          <div className="hero-copy home-hero-copy">
            <div className="eyebrow"><span className="live-dot" /> Independent security publication · Community-led</div>
            <h1>Explore.<br />Learn.<br /><em>Secure.</em></h1>
            <p>
              Your community-driven destination for cybersecurity knowledge,
              research, practical tutorials, and security insights.
            </p>
            <div className="hero-actions home-hero-actions">
              <Link className="primary-button" href="/articles">Explore articles <ArrowRight size={17} /></Link>
              <Link className="text-button" href="/learning-assistant"><BookOpen size={16} /> Start learning</Link>
            </div>
            <div className="home-hero-note"><ShieldCheck size={15} /> Reviewed by editors. Shared by practitioners.</div>
          </div>

          <article className="featured-card home-featured-card">
            <div className="featured-meta">
              <span>{featuredArticle ? "EDITOR'S PICK" : "OUR MISSION"}</span>
              <span className="severity"><i /> {featuredArticle ? "Featured research" : "Community-led"}</span>
            </div>
            <div className="featured-visual">
              {featuredArticle?.coverUrl ? (
                <Image
                  className="featured-cover"
                  src={featuredArticle.coverUrl}
                  alt=""
                  fill
                  sizes="(max-width: 900px) 100vw, 55vw"
                  unoptimized
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
                  <strong>{featuredArticle?.author ?? "CipherBrief community"}</strong>
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

      <ArticleExplorer articles={articles} />

      <section className="home-popular-section" aria-labelledby="popular-heading">
        <div className="shell">
          <div className="home-section-heading">
            <div>
              <span className="section-kicker">READER FAVORITES</span>
              <h2 id="popular-heading">Popular articles</h2>
              <p>Security writing readers are saving and appreciating.</p>
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
                    <span>{article.likeCount} {article.likeCount === 1 ? "appreciation" : "appreciations"}</span>
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
            <Link href="/sign-in">Contribute to CipherBrief <ArrowRight size={15} /></Link>
          </div>
        </div>
      </section>

      <section className="home-assistant-section" id="learn" aria-labelledby="assistant-heading">
        <div className="shell home-assistant-layout">
          <div>
            <span className="section-kicker">LEARNING, IN YOUR LANGUAGE</span>
            <h2 id="assistant-heading">A patient guide for curious minds.</h2>
            <p>Ask about a security concept, a terminal command, or a paragraph in an article. Choose a learning level and get explanations in English or Bangla.</p>
            <Link className="primary-button" href="/learning-assistant">Start learning <ArrowRight size={16} /></Link>
          </div>
          <div className="home-assistant-features">
            <article><span><Bot size={19} /></span><div><strong>Ask better questions</strong><p>Explore concepts, code, tools, and defensive practices.</p></div></article>
            <article><span><Languages size={19} /></span><div><strong>Learn in English or বাংলা</strong><p>Choose an explanation style that makes technical ideas clearer.</p></div></article>
            <article><span><ShieldCheck size={19} /></span><div><strong>Designed for responsible learning</strong><p>Use the assistant for education and authorized practice.</p></div></article>
          </div>
        </div>
      </section>

      <section className="home-newsletter-section" aria-labelledby="newsletter-heading">
        <div className="shell home-newsletter-card">
          <div className="home-newsletter-icon"><Mail size={21} /></div>
          <div>
            <span className="section-kicker">THE CIPHERBRIEF NEWSLETTER</span>
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
          <Link className="brand" href="/" aria-label="CipherBrief home">
            <span className="brand-mark"><ShieldCheck size={17} /></span>
            <span>CIPHER<span>BRIEF</span></span>
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
  if (!hasSupabaseConfiguration()) return [];
  const supabase = await createSupabaseServerClient();
  const { data: articles, error } = await supabase
    .from("articles")
    .select("id, author_id, title, slug, summary:excerpt, published_at, reading_time_minutes:reading_time, cover_image_path:cover_image, categories(name)")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(6);
  if (error) throw new Error("Unable to load published articles.", { cause: error });
  if (!articles.length) return [];

  const { data: authors, error: authorError } = await supabase.rpc("get_published_article_authors", {
    article_ids: articles.map((article) => article.id),
  });
  if (authorError) throw new Error("Unable to load published article authors.", { cause: authorError });
  const authorByArticleId = new Map((authors ?? []).map((author) => [author.article_id, author.author_name]));
  const accents = ["violet", "cyan", "orange"];

  return articles.map((article, index) => ({
    slug: article.slug,
    category: article.categories?.name ?? "Cybersecurity",
    title: article.title,
    excerpt: article.summary,
    author: authorByArticleId.get(article.id) ?? "Former member",
    date: new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(article.published_at)),
    read: `${article.reading_time_minutes} min`,
    accent: accents[index % accents.length],
    coverUrl: article.cover_image_path
      ? supabase.storage.from("article-covers").getPublicUrl(article.cover_image_path).data.publicUrl
      : null,
  }));
}

async function getFeaturedArticle() {
  if (!hasSupabaseConfiguration()) return null;
  const supabase = await createSupabaseServerClient();
  const { data: article, error } = await supabase
    .from("articles")
    .select("id, author_id, title, slug, summary:excerpt, reading_time_minutes:reading_time, cover_image_path:cover_image, categories(name)")
    .eq("status", "published")
    .eq("is_featured", true)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("Unable to load the featured article.", { cause: error });
  if (!article) return null;

  const { data: authors, error: authorError } = await supabase.rpc("get_published_article_authors", {
    article_ids: [article.id],
  });
  if (authorError) throw new Error("Unable to load the featured article author.", { cause: authorError });
  return {
    ...article,
    category: article.categories?.name ?? "Cybersecurity",
    author: authors?.[0]?.author_name ?? "Former member",
    readingTime: article.reading_time_minutes,
    coverUrl: article.cover_image_path
      ? supabase.storage.from("article-covers").getPublicUrl(article.cover_image_path).data.publicUrl
      : null,
  };
}

async function getPopularArticles() {
  if (!hasSupabaseConfiguration()) return [];
  const supabase = await createSupabaseServerClient();
  const { data: popular, error: popularError } = await supabase
    .from("article_like_counts")
    .select("article_id, like_count")
    .order("like_count", { ascending: false })
    .limit(3);
  if (popularError) throw new Error("Unable to load popular articles.", { cause: popularError });
  if (!popular?.length) return [];

  const articleIds = popular.map((item) => item.article_id);
  const { data: articles, error: articlesError } = await supabase
    .from("articles")
    .select("id, author_id, title, slug, summary:excerpt, reading_time_minutes:reading_time, categories(name)")
    .eq("status", "published")
    .in("id", articleIds);
  if (articlesError) throw new Error("Unable to load popular article details.", { cause: articlesError });

  const articleById = new Map((articles ?? []).map((article) => [article.id, article]));
  const sortedArticles = popular
    .map((item) => ({ ...articleById.get(item.article_id), likeCount: Number(item.like_count) }))
    .filter((article) => article.id);
  const { data: authors, error: authorError } = sortedArticles.length
    ? await supabase.rpc("get_published_article_authors", {
      article_ids: sortedArticles.map((article) => article.id),
    })
    : { data: [], error: null };
  if (authorError) throw new Error("Unable to load popular article authors.", { cause: authorError });
  const authorByArticleId = new Map((authors ?? []).map((author) => [author.article_id, author.author_name]));
  return sortedArticles.map((article) => ({
    ...article,
    category: article.categories?.name ?? "Cybersecurity",
    author: authorByArticleId.get(article.id) ?? "Former member",
  }));
}

function hasSupabaseConfiguration() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL
    && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

import {
  ArrowRight,
  Bot,
  FileCheck2,
  Languages,
  ShieldCheck,
  Users,
} from "lucide-react";
import ArticleExplorer from "@/components/ArticleExplorer";
import SiteHeader from "@/components/SiteHeader";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function Home() {
  const articles = await getPublishedArticles();

  return (
    <main>
      <SiteHeader />

      <section className="hero">
        <div className="shell hero-grid">
          <div className="hero-copy">
            <div className="eyebrow"><span className="live-dot" /> Independent security research · Community-led</div>
            <h1>Security knowledge,<br /><em>stronger together.</em></h1>
            <p>
              A cybersecurity publication built for real people: thoughtful
              research, practical learning, and a community that shares what works.
            </p>
            <div className="hero-actions">
              <a className="btn btn-primary primary-button" href="#latest">Explore the latest <ArrowRight size={17} /></a>
              <a className="text-button" href="#contribute"><Users size={16} /> Write with the community</a>
            </div>
          </div>

          <article className="featured-card">
            <div className="featured-meta">
              <span>THE CIPHERBRIEF APPROACH</span>
              <span className="severity"><i /> Community-led</span>
            </div>
            <div className="featured-visual">
              <div className="radar">
                <div className="radar-ring ring-one" />
                <div className="radar-ring ring-two" />
                <div className="radar-ring ring-three" />
                <div className="radar-sweep" />
                <div className="radar-node node-one" />
                <div className="radar-node node-two" />
                <div className="radar-node node-three" />
              </div>
            </div>
            <div className="featured-content">
              <div className="article-category">Learn · Research · Share</div>
              <h2>Security knowledge, shared responsibly.</h2>
              <p>Practical cybersecurity writing, reviewed by editors and published with care.</p>
              <div className="article-foot">
                <div className="author-avatar"><ShieldCheck size={16} /></div>
                <span><strong>CipherBrief</strong><small>Community publication</small></span>
                <span className="read-time"><Users size={14} /> Editorial review</span>
              </div>
            </div>
          </article>
        </div>
      </section>

      <ArticleExplorer articles={articles} />

      <section className="community-section" id="contribute">
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
              <p>Pitch a topic or submit a practical, well-sourced article.</p>
            </article>
            <article className="workflow-step">
              <span className="step-number">02</span>
              <div className="workflow-icon"><FileCheck2 size={20} /></div>
              <h3>Editorial review</h3>
              <p>Editors review accuracy, clarity, safety, and suitability for learners.</p>
            </article>
            <article className="workflow-step">
              <span className="step-number">03</span>
              <div className="workflow-icon"><ShieldCheck size={20} /></div>
              <h3>Publish together</h3>
              <p>Approved work is published with attribution and room to keep improving.</p>
            </article>
          </div>
          <div className="roles-note">
            <strong>Clear roles. Careful access.</strong>
            <span>Contributors manage their drafts, editors review submissions, and administrators manage the platform.</span>
          </div>
        </div>
      </section>

      <section className="learning-section" id="learn">
        <div className="shell learning-grid">
          <div className="learning-copy">
            <span className="section-kicker">LEARNING, IN YOUR LANGUAGE</span>
            <h2>Make complex security ideas easier to understand.</h2>
            <p>Explore concepts with a configurable local model, choose a teaching depth, and ask questions in English or Bangla. On article pages, select a passage for a focused explanation.</p>
            <a className="primary-button assistant-cta" href="/learning-assistant">Open the learning assistant <ArrowRight size={16} /></a>
          </div>
          <div className="learning-features">
            <article className="learning-feature">
              <span className="feature-icon"><Bot size={21} /></span>
              <div><h3>AI learning assistant</h3><p>Ask about concepts, commands, code, vulnerabilities, or learning paths.</p></div>
            </article>
            <article className="learning-feature">
              <span className="feature-icon"><Languages size={21} /></span>
              <div><h3>English + বাংলা</h3><p>Choose English, simple Bangla, or Bangla with English technical terms.</p></div>
            </article>
            <article className="learning-feature">
              <span className="feature-icon"><ShieldCheck size={21} /></span>
              <div><h3>Local AI, by design</h3><p>Model access stays on the server and uses your configured Ollama instance.</p></div>
            </article>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="shell footer-content">
          <a className="brand" href="#" aria-label="CipherBrief home">
            <span className="brand-mark"><ShieldCheck size={17} /></span>
            <span>CIPHER<span>BRIEF</span></span>
          </a>
          <p>Clear security knowledge. Shared responsibly.</p>
          <span className="footer-note">Community platform · Building in public</span>
        </div>
      </footer>

    </main>
  );
}

async function getPublishedArticles() {
  const hasSupabaseConfiguration =
    process.env.NEXT_PUBLIC_SUPABASE_URL !== undefined
    || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY !== undefined;
  if (!hasSupabaseConfiguration) return [];

  const supabase = await createSupabaseServerClient();
  const { data: articles, error } = await supabase
    .from("articles")
    .select("id, author_id, title, slug, summary, published_at, reading_time_minutes, cover_image_path, categories(name)")
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

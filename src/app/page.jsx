import {
  ArrowRight,
  Bot,
  Clock3,
  FileCheck2,
  Languages,
  ShieldCheck,
  Users,
} from "lucide-react";
import ArticleExplorer from "@/components/ArticleExplorer";
import SiteHeader from "@/components/SiteHeader";

export default function Home() {
  const articles = [
    {
      category: "Threat Intelligence",
      title: "Inside the 2025 ransomware economy",
      excerpt:
        "How affiliate networks, data brokers, and cloud abuse are reshaping modern extortion.",
      author: "Maya Chen",
      date: "Nov 18",
      read: "8 min",
      accent: "violet",
    },
    {
      category: "Cloud Security",
      title: "The identity-first approach to cloud defense",
      excerpt:
        "Five practical controls for reducing attack paths in complex multi-cloud environments.",
      author: "Omar Hassan",
      date: "Nov 16",
      read: "6 min",
      accent: "cyan",
    },
    {
      category: "Defense",
      title: "Detection engineering without the noise",
      excerpt:
        "A field guide to tuning detections, measuring coverage, and building high-confidence alerts.",
      author: "Lena Brooks",
      date: "Nov 14",
      read: "10 min",
      accent: "orange",
    },
  ];

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
              <span>FEATURED ANALYSIS</span>
              <span className="severity"><i /> Critical</span>
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
              <div className="article-category">Vulnerability Research</div>
              <h2>How to break the zero-day hype cycle</h2>
              <p>A practical framework for separating real exposure from manufactured urgency.</p>
              <div className="article-foot">
                <div className="author-avatar">RK</div>
                <span><strong>Rowan Keller</strong><small>Security Researcher</small></span>
                <span className="read-time"><Clock3 size={14} /> 12 min read</span>
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
            <p>Learning tools are being designed for beginners, with English and Bangla explanations and a local-AI option to keep learning closer to home.</p>
            <span className="planned-badge"><span /> IN DEVELOPMENT</span>
          </div>
          <div className="learning-features">
            <article className="learning-feature">
              <span className="feature-icon"><Bot size={21} /></span>
              <div><h3>AI learning assistant</h3><p>Beginner-friendly explanations and guided study, grounded in trusted learning content.</p></div>
            </article>
            <article className="learning-feature">
              <span className="feature-icon"><Languages size={21} /></span>
              <div><h3>English + বাংলা</h3><p>Switch languages to make security concepts more accessible to more learners.</p></div>
            </article>
            <article className="learning-feature">
              <span className="feature-icon"><ShieldCheck size={21} /></span>
              <div><h3>Local AI, by design</h3><p>Plan for local model support so learning can be more private and self-hosted.</p></div>
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

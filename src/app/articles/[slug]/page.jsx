import ResponsiveArticleImage from "@/components/media/ResponsiveArticleImage";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/layout/SiteHeader";
import ArticleLearningExperience from "@/components/articles/ArticleLearningExperience";
import { getCurrentPrincipal } from "@/lib/auth/authorization";
import { getPublishedArticleBySlug } from "@/lib/articles/public";
import { getSiteUrl } from "@/lib/seo/site";
import { createSupabasePublicClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const articleData = await getPublishedArticleBySlug(slug);
  if (!articleData) {
    return { title: "Article not found — MadQuill", robots: { index: false, follow: false } };
  }
  const { article, authorName, coverUrl } = articleData;
  const description = toMetaDescription(article.excerpt);
  const canonical = `/articles/${article.slug}`;
  const image = new URL(coverUrl ? `${coverUrl}?preview=1` : "/opengraph-image", getSiteUrl()).toString();

  return {
    title: `${article.title} — MadQuill`,
    description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      title: article.title,
      description,
      url: canonical,
      publishedTime: article.published_at,
      modifiedTime: article.updated_at || article.published_at,
      authors: [authorName],
      section: article.categories?.name ?? "Cybersecurity",
      tags: (article.article_tags ?? []).map(({ tags }) => tags?.name).filter(Boolean),
      images: [{ url: image, alt: article.title, ...(!coverUrl ? { width: 1200, height: 630 } : {}) }],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
      images: [image],
    },
  };
}

export default async function PublishedArticlePage({ params }) {
  const { slug } = await params;
  const articleData = await getPublishedArticleBySlug(slug);
  if (!articleData) notFound();
  const { article, authorName, coverUrl } = articleData;

  // Public reading must not depend on optional account or discussion services.
  const [commentsResult, principal, engagementResult] = await Promise.all([
    optionalArticleData("comments", () => loadComments(article.id), { data: [] }),
    optionalArticleData("session", () => getCurrentPrincipal(), null),
    optionalArticleData("engagement", () => createSupabasePublicClient().from("cb_article_engagement").select("view_count,comment_count,like_count").eq("article_id",article.id).maybeSingle(), { data: {} }),
  ]);

  const tags = (article.article_tags ?? []).map(({ tags }) => tags).filter(Boolean);
  const articleUrl = new URL(`/articles/${article.slug}`, getSiteUrl()).toString();
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: article.title,
    description: toMetaDescription(article.excerpt),
    image: [new URL(coverUrl ? `${coverUrl}?preview=1` : "/opengraph-image", getSiteUrl()).toString()],
    datePublished: article.published_at,
    dateModified: article.updated_at || article.published_at,
    author: {
      "@type": "Person",
      name: authorName,
      ...(article.author_id ? { url: new URL(`/authors/${article.author_id}`, getSiteUrl()).toString() } : {}),
    },
    publisher: {
      "@type": "Organization",
      name: "MadQuill",
      "@id": new URL("/#organization", getSiteUrl()).toString(),
      url: getSiteUrl().toString(),
      logo: { "@type": "ImageObject", url: new URL("/branding/madquill-icon.png", getSiteUrl()).toString() },
    },
    mainEntityOfPage: articleUrl,
    articleSection: article.categories?.name ?? "Cybersecurity",
    keywords: tags.map((tag) => tag.name),
    proficiencyLevel: article.difficulty,
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <SiteHeader />
      <article className="published-article-page">
        <div className="shell published-article-shell">
          <Link className="back-link" href="/articles">← Discover articles</Link>
          <ArticleLearningExperience
            cover={coverUrl && (
            <div className="published-article-cover">
              <ResponsiveArticleImage
                src={coverUrl} maxWidth={1920}
                alt={`${article.title} cover`}
                width={1280}
                height={640}
                sizes="(max-width: 760px) 100vw, 690px"
                priority
              />
            </div>
          )}
            articleSlug={article.slug}
            articleId={article.id}
            articlePath={`/articles/${article.slug}`}
            isReader={Boolean(principal)}
            comments={commentsResult.data ?? []}
            engagement={engagementResult.data ?? {}}
            category={article.categories?.name ?? "Cybersecurity"}
            categorySlug={article.categories?.slug}
            title={article.title}
            summary={article.excerpt}
            authorName={authorName}
            authorId={article.author_id}
            publishedDate={formatDate(article.published_at)}
            readingTime={article.reading_time}
            difficulty={article.difficulty}
            tags={tags}
            content={article.content}
          />
          <footer className="published-article-footer">
            <span>Reviewed and published by the MadQuill editorial team.</span>
            <Link href="/">Explore more security writing</Link>
          </footer>
        </div>
      </article>
    </main>
  );
}

async function optionalArticleData(label, load, fallback) {
  try {
    const result = await load();
    if (result?.error) throw result.error;
    return result ?? fallback;
  } catch (error) {
    console.warn(`[MadQuill article] Optional ${label} unavailable`, error?.code ?? error?.name ?? "unknown");
    return fallback;
  }
}

async function loadComments(articleId) {
  const supabase = createSupabasePublicClient();
  return supabase
    .from("comments")
    .select("id, body:content, created_at, display_name, is_guest")
    .eq("article_id", articleId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(100);
}

function toMetaDescription(value) {
  return (value || "Cybersecurity research and practical learning from MadQuill.")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

function formatDate(value) {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(date) : "";
}

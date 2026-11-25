import Image from "next/image";
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
  const image = coverUrl || "/opengraph-image";

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
      images: [{ url: image, width: 1200, height: 630, alt: article.title }],
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

  const [commentsResult, principal, engagementResult] = await Promise.all([
    loadComments(article.id),
    getCurrentPrincipal(),
    createSupabasePublicClient().from("cb_article_engagement").select("view_count,comment_count,like_count").eq("article_id",article.id).maybeSingle(),
  ]);
  // Comments and engagement are nonessential: allow reading during a temporary service failure.

  const tags = (article.article_tags ?? []).map(({ tags }) => tags).filter(Boolean);
  const articleUrl = new URL(`/articles/${article.slug}`, getSiteUrl()).toString();
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: article.title,
    description: toMetaDescription(article.excerpt),
    image: coverUrl ? [coverUrl] : [new URL("/opengraph-image", getSiteUrl()).toString()],
    datePublished: article.published_at,
    dateModified: article.updated_at || article.published_at,
    author: {
      "@type": "Person",
      name: authorName,
      url: new URL(`/authors/${article.author_id}`, getSiteUrl()).toString(),
    },
    publisher: {
      "@type": "Organization",
      name: "MadQuill",
      url: getSiteUrl().toString(),
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
              <Image
                src={coverUrl} unoptimized
                alt={`${article.title} cover`}
                width={1280}
                height={640}
                sizes="(max-width: 760px) 100vw, 1280px"
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
  return new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(new Date(value));
}

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/layout/SiteHeader";
import ArticleLearningExperience from "@/components/articles/ArticleLearningExperience";
import { getCurrentPrincipal } from "@/lib/auth/authorization";
import { getPublishedArticleBySlug } from "@/lib/articles/public";
import { getSiteUrl } from "@/lib/seo/site";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const articleData = await getPublishedArticleBySlug(slug);
  if (!articleData) {
    return { title: "Article not found — CipherBrief", robots: { index: false, follow: false } };
  }
  const { article, authorName, coverUrl } = articleData;
  const description = toMetaDescription(article.excerpt);
  const canonical = `/articles/${article.slug}`;
  const image = coverUrl || "/opengraph-image";

  return {
    title: `${article.title} — CipherBrief`,
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

  const [commentsResult, principal] = await Promise.all([
    loadComments(article.id),
    getCurrentPrincipal(),
  ]);
  if (commentsResult.error) throw new Error("Unable to load article comments.", { cause: commentsResult.error });

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
      name: "CipherBrief",
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
          <Link className="back-link" href="/#latest">← Latest articles</Link>
          {coverUrl && (
            <div className="published-article-cover">
              <Image
                src={coverUrl}
                alt={`${article.title} cover`}
                width={1280}
                height={640}
                sizes="(max-width: 760px) 100vw, 1280px"
                priority
              />
            </div>
          )}
          <ArticleLearningExperience
            articleSlug={article.slug}
            articleId={article.id}
            articlePath={`/articles/${article.slug}`}
            isReader={principal?.role === "reader"}
            comments={commentsResult.data ?? []}
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
            <span>Reviewed and published by the CipherBrief editorial team.</span>
            <Link href="/">Explore more security writing</Link>
          </footer>
        </div>
      </article>
    </main>
  );
}

async function loadComments(articleId) {
  const supabase = await createSupabaseServerClient();
  return supabase
    .from("comments")
    .select("id, body:content, created_at")
    .eq("article_id", articleId)
    .eq("status", "published")
    .order("created_at", { ascending: true })
    .limit(100);
}

function toMetaDescription(value) {
  return (value || "Cybersecurity research and practical learning from CipherBrief.")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(new Date(value));
}

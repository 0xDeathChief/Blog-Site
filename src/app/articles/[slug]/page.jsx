import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import ArticleLearningExperience from "@/components/articles/ArticleLearningExperience";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PublishedArticlePage({ params }) {
  const { slug } = await params;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const { data: article, error } = await supabase
    .from("articles")
    .select("id, author_id, title, slug, summary, content, difficulty, reading_time_minutes, published_at, cover_image_path, categories(name), article_tags(tags(id, name, slug))")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!article) {
    if (error) throw new Error("Unable to load this article.", { cause: error });
    notFound();
  }

  const { data: authors, error: authorError } = await supabase.rpc("get_published_article_authors", {
    article_ids: [article.id],
  });
  if (authorError) throw new Error("Unable to load the article author.", { cause: authorError });

  const authorName = authors?.[0]?.author_name ?? "Former member";
  const coverUrl = article.cover_image_path
    ? supabase.storage.from("article-covers").getPublicUrl(article.cover_image_path).data.publicUrl
    : null;

  return (
    <main>
      <SiteHeader />
      <article className="published-article-page">
        <div className="shell published-article-shell">
          <Link className="back-link" href="/#latest">← Latest articles</Link>
          {coverUrl && (
            <div className="published-article-cover">
              <Image src={coverUrl} alt="" width={1280} height={640} unoptimized priority />
            </div>
          )}
          <ArticleLearningExperience
            articleSlug={article.slug}
            category={article.categories?.name ?? "Cybersecurity"}
            title={article.title}
            summary={article.summary}
            authorName={authorName}
            publishedDate={formatDate(article.published_at)}
            readingTime={article.reading_time_minutes}
            difficulty={article.difficulty}
            tags={article.article_tags?.map(({ tags }) => tags?.name).filter(Boolean) ?? []}
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

function formatDate(value) {
  return new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(new Date(value));
}

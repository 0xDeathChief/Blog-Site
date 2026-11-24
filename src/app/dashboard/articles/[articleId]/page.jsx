import { notFound } from "next/navigation";
import ArticleWorkspace from "@/components/articles/ArticleWorkspace";
import { requireArticlePage } from "@/lib/articles/page-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ArticlePage({ params }) {
  const { articleId } = await params;
  const principal = await requireArticlePage(
    ["owner", "editor", "contributor"],
    `/dashboard/articles/${articleId}`,
  );
  const supabase = await createSupabaseServerClient();
  const [articleResult, categoriesResult, tagsResult, revisionsResult, eventsResult, feedbackResult] = await Promise.all([
    supabase
      .from("articles")
      .select("id, author_id, title, slug, summary:excerpt, content, status, difficulty, reading_time_minutes:reading_time, category_id, cover_image_path:cover_image, updated_at, categories(name), article_tags(tag_id, tags(id, name, slug))")
      .eq("id", articleId)
      .maybeSingle(),
    supabase.from("categories").select("id, name").eq("is_active", true).order("name"),
    supabase.from("tags").select("id, name").order("name"),
    supabase
      .from("article_revisions")
      .select("id, revision_number, title, slug, summary:excerpt, difficulty, reading_time_minutes:reading_time, tags, created_at")
      .eq("article_id", articleId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("article_events")
      .select("id, actor_name, action, from_status, to_status, created_at")
      .eq("article_id", articleId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("article_reviews")
      .select("id, reviewer_name, kind:status, message:feedback, previous_status, new_status, created_at")
      .eq("article_id", articleId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (!articleResult.data) {
    if (articleResult.error) throw new Error("Unable to load this article.", { cause: articleResult.error });
    notFound();
  }
  if (principal.role === "contributor" && articleResult.data.author_id !== principal.id) {
    notFound();
  }
  if (categoriesResult.error || tagsResult.error || revisionsResult.error || eventsResult.error || feedbackResult.error) {
    throw new Error("Unable to load article history and metadata.", {
      cause: categoriesResult.error ?? tagsResult.error ?? revisionsResult.error ?? eventsResult.error ?? feedbackResult.error,
    });
  }

  const { data: author, error: authorError } = articleResult.data.author_id
    ? await supabase.from("profiles").select("display_name:full_name").eq("id", articleResult.data.author_id).maybeSingle()
    : { data: null, error: null };
  if (authorError) throw new Error("Unable to load the article author.", { cause: authorError });

  const coverUrl = articleResult.data.cover_image_path
    ? supabase.storage.from("article-covers").getPublicUrl(articleResult.data.cover_image_path).data.publicUrl
    : null;

  return (
    <ArticleWorkspace
      article={articleResult.data}
      authorName={author?.display_name ?? "Former member"}
      categories={categoriesResult.data ?? []}
      tags={tagsResult.data ?? []}
      role={principal.role}
      userId={principal.id}
      revisions={revisionsResult.data ?? []}
      events={eventsResult.data ?? []}
      feedback={feedbackResult.data ?? []}
      coverUrl={coverUrl}
    />
  );
}

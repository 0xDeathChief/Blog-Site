import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const hasSupabaseConfiguration = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL
  && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

export async function getPublishedArticles({
  query = "",
  categorySlug = "",
  tagSlug = "",
  authorId = "",
  limit = 200,
} = {}) {
  if (!hasSupabaseConfiguration) return [];

  const supabase = await createSupabaseServerClient();
  let articleQuery = supabase
    .from("articles")
    .select("id, author_id, title, slug, summary:excerpt, published_at, reading_time_minutes:reading_time, difficulty, cover_image_path:cover_image, categories(name, slug), article_tags(tags(name, slug))")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (categorySlug) articleQuery = articleQuery.eq("categories.slug", categorySlug);
  if (authorId) articleQuery = articleQuery.eq("author_id", authorId);

  const { data: articles, error } = await articleQuery;
  if (error) throw new Error("Unable to load published articles.", { cause: error });

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredArticles = (articles ?? []).filter((article) => {
    const matchesQuery = !normalizedQuery
      || `${article.title} ${article.summary} ${article.categories?.name ?? ""} ${(article.article_tags ?? []).map(({ tags }) => tags?.name ?? "").join(" ")}`
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    const matchesTag = !tagSlug
      || (article.article_tags ?? []).some(({ tags }) => tags?.slug === tagSlug);
    return matchesQuery && matchesTag;
  });
  if (!filteredArticles.length) return [];

  const { data: authors, error: authorError } = await supabase.rpc(
    "get_published_article_authors",
    { article_ids: filteredArticles.map((article) => article.id) },
  );
  if (authorError) throw new Error("Unable to load published article authors.", { cause: authorError });
  const authorByArticleId = new Map(
    (authors ?? []).map((author) => [author.article_id, author.author_name]),
  );

  return filteredArticles.map((article) => ({
    ...article,
    category: article.categories?.name ?? "Cybersecurity",
    author: authorByArticleId.get(article.id) ?? "Former member",
    tags: (article.article_tags ?? []).map(({ tags }) => tags).filter(Boolean),
    coverUrl: article.cover_image_path
      ? supabase.storage.from("article-covers").getPublicUrl(article.cover_image_path).data.publicUrl
      : null,
  }));
}

export async function getPublicCategories() {
  if (!hasSupabaseConfiguration) return [];
  const supabase = await createSupabaseServerClient();
  const [categoriesResult, articlesResult] = await Promise.all([
    supabase.from("categories").select("id, name, slug").eq("is_active", true).order("name"),
    supabase.from("articles").select("category_id").eq("status", "published"),
  ]);
  if (categoriesResult.error || articlesResult.error) {
    throw new Error("Unable to load published categories.", {
      cause: categoriesResult.error ?? articlesResult.error,
    });
  }
  const countByCategory = new Map();
  for (const article of articlesResult.data ?? []) {
    if (article.category_id) {
      countByCategory.set(article.category_id, (countByCategory.get(article.category_id) ?? 0) + 1);
    }
  }
  return (categoriesResult.data ?? []).map((category) => ({
    ...category,
    articleCount: countByCategory.get(category.id) ?? 0,
  }));
}

export async function getPublicTags() {
  if (!hasSupabaseConfiguration) return [];
  const supabase = await createSupabaseServerClient();
  const [tagsResult, articleTagsResult] = await Promise.all([
    supabase.from("tags").select("id, name, slug").order("name"),
    supabase.from("article_tags").select("tag_id, articles!inner(status)").eq("articles.status", "published"),
  ]);
  if (tagsResult.error || articleTagsResult.error) {
    throw new Error("Unable to load published tags.", {
      cause: tagsResult.error ?? articleTagsResult.error,
    });
  }
  const countByTag = new Map();
  for (const relation of articleTagsResult.data ?? []) {
    countByTag.set(relation.tag_id, (countByTag.get(relation.tag_id) ?? 0) + 1);
  }
  return (tagsResult.data ?? []).map((tag) => ({
    ...tag,
    articleCount: countByTag.get(tag.id) ?? 0,
  })).filter((tag) => tag.articleCount > 0);
}

export async function getPublicAuthors(authorId = null) {
  if (!hasSupabaseConfiguration) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_public_authors", {
    target_author_id: authorId,
  });
  if (error) throw new Error("Unable to load public authors.", { cause: error });
  return data ?? [];
}

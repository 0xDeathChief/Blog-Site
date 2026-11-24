import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const hasSupabaseConfiguration = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL
  && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

export const ARTICLE_PAGE_SIZE = 12;

const difficultyValues = new Set(["beginner", "intermediate", "advanced", "expert"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseArticleDiscoveryFilters(params, defaults = {}) {
  const queryValue = readParam(params, "q");
  const categoryValue = readParam(params, "category");
  const tagValue = readParam(params, "tag");
  const difficultyValue = readParam(params, "difficulty");
  const authorValue = readParam(params, "author");
  const sortValue = readParam(params, "sort");
  const pageValue = Number(readParam(params, "page"));

  return {
    query: queryValue.trim().slice(0, 100),
    categorySlug: categoryValue.length <= 160 && slugPattern.test(categoryValue)
      ? categoryValue
      : defaults.categorySlug ?? "",
    tagSlug: tagValue.length <= 160 && slugPattern.test(tagValue)
      ? tagValue
      : defaults.tagSlug ?? "",
    difficulty: difficultyValues.has(difficultyValue) ? difficultyValue : "",
    authorId: uuidPattern.test(authorValue) ? authorValue : defaults.authorId ?? "",
    sort: sortValue === "popularity" ? "popularity" : "newest",
    page: Number.isSafeInteger(pageValue) && pageValue > 0 ? Math.min(pageValue, 10000) : 1,
  };
}

export async function getPublishedArticlePage(filters) {
  const requestedPage = filters.page ?? 1;
  if (!hasSupabaseConfiguration) {
    return { articles: [], total: 0, page: 1, pageSize: ARTICLE_PAGE_SIZE, totalPages: 1 };
  }

  const supabase = await createSupabaseServerClient();
  async function loadPage(page) {
    const { data, error } = await supabase.rpc("search_published_articles", {
      search_text: filters.query ?? "",
      category_filter: filters.categorySlug || null,
      tag_filter: filters.tagSlug || null,
      difficulty_filter: filters.difficulty || null,
      author_filter: filters.authorId || null,
      sort_order: filters.sort ?? "newest",
      page_number: page,
      page_size: ARTICLE_PAGE_SIZE,
    });
    if (error) throw new Error("Unable to search published articles.", { cause: error });
    return data;
  }

  const result = await loadPage(requestedPage);
  const total = Math.max(0, Number(result?.total) || 0);
  const totalPages = Math.max(1, Math.ceil(total / ARTICLE_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const pageResult = page === requestedPage ? result : await loadPage(page);
  const rawArticles = Array.isArray(pageResult?.articles) ? pageResult.articles : [];
  if (!rawArticles.length) {
    return { articles: [], total, page, pageSize: ARTICLE_PAGE_SIZE, totalPages };
  }

  const { data: authors, error: authorError } = await supabase.rpc(
    "get_published_article_authors",
    { article_ids: rawArticles.map((article) => article.id) },
  );
  if (authorError) throw new Error("Unable to load published article authors.", { cause: authorError });
  const authorByArticleId = new Map(
    (authors ?? []).map((author) => [author.article_id, author.author_name]),
  );

  const articles = rawArticles.map((article) => ({
    ...article,
    category: article.category ?? "Cybersecurity",
    author: authorByArticleId.get(article.id) ?? "Former member",
    likeCount: Number(article.like_count) || 0,
    tags: [],
    coverUrl: article.cover_image_path
      ? supabase.storage.from("article-covers").getPublicUrl(article.cover_image_path).data.publicUrl
      : null,
  }));
  return { articles, total, page, pageSize: ARTICLE_PAGE_SIZE, totalPages };
}

export async function getArticleDiscoveryOptions() {
  const [categories, tags, authors] = await Promise.all([
    getPublicCategories(),
    getPublicTags(),
    getPublicAuthors(),
  ]);
  return { categories, tags, authors };
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

function readParam(params, name) {
  return typeof params?.[name] === "string" ? params[name] : "";
}

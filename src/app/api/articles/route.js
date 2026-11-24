import { NextResponse } from "next/server";
import {
  articleActionSchema,
  sanitizeArticleContent,
  saveArticleSchema,
} from "@/lib/articles/content";
import { readJsonBody, requireRoleApi } from "@/lib/auth/api";

const articleRoles = ["owner", "editor", "contributor"];

export async function GET(request) {
  const authorization = await requireRoleApi(request, articleRoles);
  if (authorization.response) return authorization.response;

  let articleQuery = authorization.supabase
    .from("articles")
    .select("id, author_id, title, slug, summary, status, difficulty, reading_time_minutes, category_id, updated_at, categories(name)")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (authorization.principal.role === "contributor") {
    articleQuery = articleQuery.eq("author_id", authorization.principal.id);
  }
  const { data: articles, error } = await articleQuery;

  if (error) {
    return NextResponse.json({ error: "Unable to load articles." }, { status: 502 });
  }

  const authorIds = [...new Set(articles.map((article) => article.author_id).filter(Boolean))];
  const { data: authors, error: authorError } = authorIds.length
    ? await authorization.supabase.from("profiles").select("id, display_name").in("id", authorIds)
    : { data: [], error: null };
  if (authorError) {
    return NextResponse.json({ error: "Unable to load article authors." }, { status: 502 });
  }

  const authorById = new Map((authors ?? []).map((author) => [author.id, author.display_name]));
  return NextResponse.json({
    articles: articles.map((article) => ({
      ...article,
      author_name: authorById.get(article.author_id) ?? "Former member",
    })),
  });
}

export async function POST(request) {
  const authorization = await requireRoleApi(request, ["owner", "contributor"], { mutating: true });
  if (authorization.response) return authorization.response;

  const parsedBody = await readJsonBody(request);
  if (parsedBody.response) return parsedBody.response;
  const parsedArticle = saveArticleSchema.omit({ id: true }).safeParse(parsedBody.body);
  if (!parsedArticle.success) {
    return NextResponse.json({ error: "Check the article fields and try again." }, { status: 400 });
  }
  const sanitizedContent = sanitizeArticleContent(parsedArticle.data.content);
  if (!sanitizedContent.success) {
    return NextResponse.json({ error: "Article content contains unsupported or unsafe formatting." }, { status: 400 });
  }

  const article = parsedArticle.data;
  const { data: articleId, error } = await authorization.supabase.rpc("save_article", {
    target_article_id: article.id ?? null,
    article_title: article.title,
    article_slug: article.slug,
    article_summary: article.summary,
    article_content: sanitizedContent.document,
    article_category_id: article.categoryId,
    article_cover_image_path: article.coverImagePath,
    article_difficulty: article.difficulty,
    article_tag_ids: article.tagIds,
  });

  if (error) {
    const status = error.code === "23505" ? 409
      : error.code === "42501" ? 403
        : error.code === "22023" ? 400
          : error.code === "P0002" ? 404
            : 502;
    return NextResponse.json(
      {
        error: status === 409
          ? "That article slug is already in use."
          : status === 400
            ? "The selected category or tags are no longer available."
            : "Unable to save the article.",
      },
      { status },
    );
  }

  return NextResponse.json({ id: articleId }, { status: 201 });
}

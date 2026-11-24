import { NextResponse } from "next/server";
import {
  articleActionSchema,
  sanitizeArticleContent,
  saveArticleSchema,
} from "@/lib/articles/content";
import { readJsonBody, requireRoleApi } from "@/lib/auth/api";
import { z } from "zod";

const articleRoles = ["owner", "editor", "contributor"];
const articleIdSchema = z.string().uuid();

export async function GET(request, context) {
  const authorization = await requireRoleApi(request, articleRoles);
  if (authorization.response) return authorization.response;
  const { articleId } = await context.params;
  if (!articleIdSchema.safeParse(articleId).success) {
    return NextResponse.json({ error: "Invalid article ID." }, { status: 400 });
  }

  const { data: article, error } = await authorization.supabase
    .from("articles")
    .select("id, author_id, title, slug, summary:excerpt, content, status, difficulty, reading_time_minutes:reading_time, category_id, cover_image_path:cover_image, updated_at, categories(name), article_tags(tag_id, tags(id, name, slug))")
    .eq("id", articleId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Unable to load this article." }, { status: 502 });
  if (!article) return NextResponse.json({ error: "Article not found." }, { status: 404 });
  if (
    authorization.principal.role === "contributor"
    && article.author_id !== authorization.principal.id
  ) {
    return NextResponse.json({ error: "Article not found." }, { status: 404 });
  }

  const [revisions, events, feedback] = await Promise.all([
    authorization.supabase
      .from("article_revisions")
      .select("id, actor_id:editor_id, revision_number, title, slug, summary:excerpt, category_id, cover_image_path:cover_image, difficulty, reading_time_minutes:reading_time, tags, created_at")
      .eq("article_id", articleId)
      .order("created_at", { ascending: false })
      .limit(50),
    authorization.supabase
      .from("article_events")
      .select("id, actor_id, actor_name, action, from_status, to_status, created_at")
      .eq("article_id", articleId)
      .order("created_at", { ascending: false })
      .limit(100),
    authorization.supabase
      .from("article_reviews")
      .select("id, editor_id:reviewer_id, reviewer_name, kind:status, message:feedback, previous_status, new_status, created_at")
      .eq("article_id", articleId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (revisions.error || events.error || feedback.error) {
    return NextResponse.json({ error: "Unable to load article history." }, { status: 502 });
  }

  return NextResponse.json({
    article,
    revisions: revisions.data,
    events: events.data,
    feedback: feedback.data,
  });
}

export async function PATCH(request, context) {
  const authorization = await requireRoleApi(request, articleRoles, { mutating: true });
  if (authorization.response) return authorization.response;
  const { articleId } = await context.params;
  if (!articleIdSchema.safeParse(articleId).success) {
    return NextResponse.json({ error: "Invalid article ID." }, { status: 400 });
  }

  const parsedBody = await readJsonBody(request);
  if (parsedBody.response) return parsedBody.response;
  const parsedArticle = saveArticleSchema.safeParse({ ...parsedBody.body, id: articleId });
  if (!parsedArticle.success) {
    return NextResponse.json({ error: "Check the article fields and try again." }, { status: 400 });
  }
  const sanitizedContent = sanitizeArticleContent(parsedArticle.data.content);
  if (!sanitizedContent.success) {
    return NextResponse.json({ error: "Article content contains unsupported or unsafe formatting." }, { status: 400 });
  }

  const article = parsedArticle.data;
  const { error } = await authorization.supabase.rpc("save_article", {
    target_article_id: articleId,
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

  return NextResponse.json({ id: articleId });
}

export async function POST(request, context) {
  const authorization = await requireRoleApi(request, articleRoles, { mutating: true });
  if (authorization.response) return authorization.response;
  const { articleId } = await context.params;
  if (!articleIdSchema.safeParse(articleId).success) {
    return NextResponse.json({ error: "Invalid article ID." }, { status: 400 });
  }

  const parsedBody = await readJsonBody(request);
  if (parsedBody.response) return parsedBody.response;
  const parsedAction = articleActionSchema.safeParse(parsedBody.body);
  if (!parsedAction.success) {
    return NextResponse.json({ error: "Choose a valid article workflow action." }, { status: 400 });
  }
  const { action, feedback } = parsedAction.data;

  const { error } = await authorization.supabase.rpc("transition_article", {
    target_article_id: articleId,
    requested_action: action,
    feedback_message: feedback ?? null,
  });
  if (error) {
    const status = error.code === "42501" ? 403 : error.code === "22023" ? 400 : error.code === "P0002" ? 404 : 409;
    return NextResponse.json({ error: "This article cannot make that workflow transition." }, { status });
  }

  return NextResponse.json({ status: "updated" });
}

export async function DELETE(request, context) {
  const authorization = await requireRoleApi(request, ["owner"], { mutating: true });
  if (authorization.response) return authorization.response;
  const { articleId } = await context.params;
  if (!articleIdSchema.safeParse(articleId).success) {
    return NextResponse.json({ error: "Invalid article ID." }, { status: 400 });
  }

  const { error } = await authorization.supabase.rpc("delete_article", {
    target_article_id: articleId,
  });
  if (error) {
    const status = error.code === "P0002" ? 404 : error.code === "42501" ? 403 : 502;
    return NextResponse.json({ error: "Unable to delete this article." }, { status });
  }

  return new NextResponse(null, { status: 204 });
}

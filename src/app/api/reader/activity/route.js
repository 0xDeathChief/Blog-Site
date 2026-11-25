import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody, requireRoleApi } from "@/lib/auth/api";

const activitySchema = z.object({
  action: z.enum(["bookmark", "like", "comment", "read"]),
  articleId: z.string().uuid(),
  body: z.string().trim().min(1).max(2000).optional(),
}).strict().superRefine((value, context) => {
  if (value.action === "comment" && !value.body) {
    context.addIssue({ code: "custom", path: ["body"], message: "A comment is required." });
  }
});

export async function GET(request) {
  const context = await requireRoleApi(request, ["reader", "contributor", "editor", "owner"]);
  if (context.response) return context.response;
  const articleId = new URL(request.url).searchParams.get("articleId");
  if (!articleId || !z.string().uuid().safeParse(articleId).success) {
    return NextResponse.json({ error: "A valid article ID is required." }, { status: 400 });
  }
  const [bookmarkResult, likeResult] = await Promise.all([
    context.supabase.from("bookmarks").select("article_id").eq("user_id", context.principal.id).eq("article_id", articleId).maybeSingle(),
    context.supabase.from("likes").select("article_id").eq("user_id", context.principal.id).eq("article_id", articleId).maybeSingle(),
  ]);
  if (bookmarkResult.error || likeResult.error) {
    return NextResponse.json({ error: "Unable to load your article activity." }, { status: 502 });
  }
  return NextResponse.json({
    bookmarked: Boolean(bookmarkResult.data),
    liked: Boolean(likeResult.data),
  });
}

export async function POST(request) {
  const context = await requireRoleApi(request, ["reader", "contributor", "editor", "owner"], { mutating: true });
  if (context.response) return context.response;
  const parsedBody = await readJsonBody(request, { maxBytes: 8192 });
  if (parsedBody.response) return parsedBody.response;
  const parsed = activitySchema.safeParse(parsedBody.body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the article activity and try again." }, { status: 400 });
  }
  const { action, articleId, body } = parsed.data;
  let result;
  if (action === "bookmark") {
    result = await context.supabase.from("bookmarks").insert({
      user_id: context.principal.id,
      article_id: articleId,
    });
  } else if (action === "like") {
    result = await context.supabase.from("likes").insert({
      user_id: context.principal.id,
      article_id: articleId,
    });
  } else if (action === "comment") {
    result = await context.supabase.from("comments").insert({
      user_id: context.principal.id,
      article_id: articleId,
      content: body,
    }).select("id,body:content,created_at,display_name,is_guest").single();
  } else {
    result = await context.supabase.from("article_reading_history").upsert(
      { user_id: context.principal.id, article_id: articleId, last_read_at: new Date().toISOString() },
      { onConflict: "user_id,article_id" },
    );
  }
  if (result.error?.code === "23505" && ["bookmark", "like"].includes(action)) {
    return NextResponse.json({ status: "saved" }, { status: 201 });
  }
  if (result.error) {
    return NextResponse.json({ error: action === "read" ? "Unable to update reading history." : "Unable to save this activity." }, { status: 502 });
  }
  return NextResponse.json({ status: "saved", ...(action === "comment" ? {comment:result.data} : {}) }, { status: 201 });
}

export async function DELETE(request) {
  const context = await requireRoleApi(request, ["reader", "contributor", "editor", "owner"], { mutating: true });
  if (context.response) return context.response;
  const parsedBody = await readJsonBody(request, { maxBytes: 4096 });
  if (parsedBody.response) return parsedBody.response;
  const parsed = z.object({
    action: z.enum(["bookmark", "like"]),
    articleId: z.string().uuid(),
  }).strict().safeParse(parsedBody.body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a valid activity to remove." }, { status: 400 });
  }
  const table = parsed.data.action === "bookmark" ? "bookmarks" : "likes";
  const { error } = await context.supabase
    .from(table)
    .delete()
    .eq("user_id", context.principal.id)
    .eq("article_id", parsed.data.articleId);
  if (error) return NextResponse.json({ error: "Unable to remove this activity." }, { status: 502 });
  return NextResponse.json({ status: "removed" });
}

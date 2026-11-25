import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import ArticleCards from "@/components/public/ArticleCards";
import PortalFrame from "@/components/portal/PortalFrame";
import { PortalRecords } from "@/components/portal/PortalArticles";
import { requireArticlePage } from "@/lib/articles/page-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const config = {
  bookmarks: { title: "Bookmarks", description: "Articles you saved for later." },
  likes: { title: "Liked articles", description: "Published writing you have appreciated." },
  comments: { title: "Your comments", description: "Comments you have posted on published articles." },
  "reading-history": { title: "Reading history", description: "Published articles you have opened, most recent first." },
};

export default async function ReaderCollectionPage({ kind }) {
  const page = config[kind];
  if (!page) notFound();
  const allowedRoles = ["reader", "contributor", "editor", "owner"];
  const principal = await requireArticlePage(allowedRoles, `/${kind}`);
  const supabase = await createSupabaseServerClient();
  const area = principal.role === "owner" ? "owner"
    : principal.role === "editor" ? "editor"
      : principal.role === "contributor" ? "contributor"
        : "reader";

  if (kind === "comments") {
    const { data, error } = await supabase.from("comments")
      .select("id, body:content, created_at, articles!inner(title, slug, status)")
      .eq("user_id", principal.id).eq("articles.status", "published")
      .eq("status", "published")
      .order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error("Unable to load your comments.", { cause: error });
    const records = (data ?? []).map((item) => ({
      id: item.id,
      title: item.articles?.title,
      articleTitle: item.articles?.title,
      articleSlug: item.articles?.slug,
      message: item.body,
      created_at: item.created_at,
    }));
    return <PortalFrame principal={principal} area={area} title={page.title} description={page.description}><PortalRecords records={records} empty="You have not posted any comments." /></PortalFrame>;
  }

  const table = kind === "bookmarks" ? "bookmarks"
    : kind === "likes" ? "likes"
      : "article_reading_history";
  const { data, error } = await supabase.from(table)
    .select(kind === "reading-history"
      ? "last_read_at, articles!inner(id, author_id, title, slug, summary:excerpt, published_at, reading_time_minutes:reading_time, cover_image_path:cover_image, categories(name, slug))"
      : "created_at, articles!inner(id, author_id, title, slug, summary:excerpt, published_at, reading_time_minutes:reading_time, cover_image_path:cover_image, categories(name, slug))")
    .eq("user_id", principal.id)
    .eq("articles.status", "published")
    .order(kind === "reading-history" ? "last_read_at" : "created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Unable to load your ${page.title.toLowerCase()}.`, { cause: error });
  const articles = (data ?? []).map((item) => ({
    ...item.articles,
    category: item.articles.categories?.name ?? "Cybersecurity",
    published_at: item.articles.published_at,
  }));
  const authorIds = [...new Set(articles.map((article) => article.author_id).filter(Boolean))];
  const { data: authors, error: authorError } = authorIds.length
    ? await supabase.rpc("get_published_article_authors", {
      article_ids: (data ?? []).map((item) => item.articles.id),
    })
    : { data: [], error: null };
  if (authorError) throw new Error("Unable to load article authors.", { cause: authorError });
  const authorById = new Map((authors ?? []).map((item) => [item.article_id, item.author_name]));
  const cards = articles.map((article) => ({
    ...article,
    author: authorById.get(article.id) ?? "Former member",
    coverUrl: article.cover_image_path
      ? `/api/article-media/${article.cover_image_path}`
      : null,
  }));
  return <PortalFrame principal={principal} area={area} title={page.title} description={page.description}><ArticleCards articles={cards} emptyMessage={`No ${page.title.toLowerCase()} yet.`} /></PortalFrame>;
}

export function ConversationDetail({ conversation }) {
  return (
    <div className="conversation-detail">
      {conversation.messages.map((message) => (
        <article className={`conversation-message conversation-${message.role}`} key={message.id}>
          <strong>{message.role === "user" ? "You" : "MadQuill assistant"}</strong>
          <ReactMarkdown>{message.content}</ReactMarkdown>
          {message.createdAt && <time dateTime={message.createdAt}>{formatDate(message.createdAt)}</time>}
        </article>
      ))}
    </div>
  );
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

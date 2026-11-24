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
  "ai-conversations": { title: "AI conversations", description: "Your saved learning-assistant sessions." },
};

export default async function ReaderCollectionPage({ kind }) {
  const page = config[kind];
  if (!page) notFound();
  const allowedRoles = kind === "ai-conversations"
    ? ["owner", "editor", "contributor", "reader"]
    : ["reader"];
  const principal = await requireArticlePage(allowedRoles, `/${kind}`);
  const supabase = await createSupabaseServerClient();
  const area = principal.role === "owner" ? "owner"
    : principal.role === "editor" ? "editor"
      : principal.role === "contributor" ? "contributor"
        : "reader";

  if (kind === "ai-conversations") {
    const { data, error } = await supabase.from("ai_conversations")
      .select("id, title, created_at, updated_at, message_count")
      .eq("user_id", principal.id).order("updated_at", { ascending: false }).limit(100);
    if (error) throw new Error("Unable to load your AI conversations.", { cause: error });
    return (
      <PortalFrame principal={principal} area={area} title={page.title} description={page.description}>
        <div className="conversation-list">
          {(data ?? []).length ? (data ?? []).map((item) => (
            <article className="portal-card conversation-card" key={item.id}>
              <div><h2>{item.title}</h2><p>{item.message_count} messages · Updated {formatDate(item.updated_at)}</p></div>
              <a className="secondary-button" href={`/ai-conversations/${item.id}`}>Open conversation</a>
            </article>
          )) : <div className="empty-state portal-card"><strong>No saved conversations yet.</strong><p>Sign in while using the assistant to keep a private history of your learning chats.</p></div>}
        </div>
      </PortalFrame>
    );
  }

  if (kind === "comments") {
    const { data, error } = await supabase.from("article_comments")
      .select("id, body, created_at, articles!inner(title, slug, status)")
      .eq("user_id", principal.id).eq("articles.status", "published")
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

  const table = kind === "bookmarks" ? "article_bookmarks"
    : kind === "likes" ? "article_likes"
      : "article_reading_history";
  const { data, error } = await supabase.from(table)
    .select(kind === "reading-history"
      ? "last_read_at, articles!inner(id, author_id, title, slug, summary, published_at, reading_time_minutes, cover_image_path, categories(name, slug))"
      : "created_at, articles!inner(id, author_id, title, slug, summary, published_at, reading_time_minutes, cover_image_path, categories(name, slug))")
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
      ? supabase.storage.from("article-covers").getPublicUrl(article.cover_image_path).data.publicUrl
      : null,
  }));
  return <PortalFrame principal={principal} area={area} title={page.title} description={page.description}><ArticleCards articles={cards} emptyMessage={`No ${page.title.toLowerCase()} yet.`} /></PortalFrame>;
}

export function ConversationDetail({ conversation }) {
  return (
    <div className="conversation-detail">
      {conversation.messages.map((message) => (
        <article className={`conversation-message conversation-${message.role}`} key={message.id}>
          <strong>{message.role === "user" ? "You" : "CipherBrief assistant"}</strong>
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

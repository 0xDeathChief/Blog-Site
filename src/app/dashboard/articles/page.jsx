import ArticleDashboard from "@/components/articles/ArticleDashboard";
import { requireArticlePage } from "@/lib/articles/page-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Article workspace — MadQuill" };
export const dynamic = "force-dynamic";

export default async function ArticlesPage() {
  const principal = await requireArticlePage(
    ["owner", "editor", "contributor"],
    "/dashboard/articles",
  );
  const supabase = await createSupabaseServerClient();
  let articleQuery = supabase
    .from("articles")
    .select("id, author_id, title, slug, summary:excerpt, status, difficulty, reading_time_minutes:reading_time, updated_at, categories(name)")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (principal.role === "contributor") {
    articleQuery = articleQuery.eq("author_id", principal.id);
  }
  const { data: articles, error } = await articleQuery;
  if (error) throw new Error("Unable to load your article workspace.", { cause: error });

  const authorIds = [...new Set((articles ?? []).map((article) => article.author_id).filter(Boolean))];
  const { data: authors, error: authorError } = authorIds.length
    ? await supabase.from("profiles").select("id, display_name:full_name").in("id", authorIds)
    : { data: [], error: null };
  if (authorError) throw new Error("Unable to load article authors.", { cause: authorError });
  const authorById = new Map((authors ?? []).map((author) => [author.id, author.display_name]));

  return (
    <ArticleDashboard
      role={principal.role}
      displayName={principal.displayName}
      articles={(articles ?? []).map((article) => ({
        ...article,
        author_name: authorById.get(article.author_id) ?? "Former member",
      }))}
    />
  );
}

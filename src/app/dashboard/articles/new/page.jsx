import ArticleWorkspace from "@/components/articles/ArticleWorkspace";
import { requireArticlePage } from "@/lib/articles/page-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Write an article — CipherBrief" };
export const dynamic = "force-dynamic";

export default async function NewArticlePage() {
  const principal = await requireArticlePage(["owner", "contributor"], "/dashboard/articles/new");
  const supabase = await createSupabaseServerClient();
  const [categoriesResult, tagsResult] = await Promise.all([
    supabase.from("categories").select("id, name").eq("is_active", true).order("name"),
    supabase.from("tags").select("id, name").order("name"),
  ]);
  if (categoriesResult.error || tagsResult.error) {
    throw new Error("Unable to load article categories and tags.", {
      cause: categoriesResult.error ?? tagsResult.error,
    });
  }

  return (
    <ArticleWorkspace
      article={null}
      authorName={principal.displayName}
      categories={categoriesResult.data ?? []}
      tags={tagsResult.data ?? []}
      role={principal.role}
      userId={principal.id}
    />
  );
}

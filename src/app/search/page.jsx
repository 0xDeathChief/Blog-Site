import ArticleCards from "@/components/public/ArticleCards";
import PublicPage from "@/components/public/PublicPage";
import { getPublishedArticles } from "@/lib/articles/public";

export const metadata = { title: "Search — CipherBrief" };
export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }) {
  const params = await searchParams;
  const query = typeof params?.q === "string" ? params.q.trim().slice(0, 100) : "";
  const articles = query ? await getPublishedArticles({ query }) : [];
  return (
    <PublicPage kicker="SEARCH" title="Search the publication" description={query ? `Results for “${query}”.` : "Search published articles by title, topic, or summary."}>
      <form className="public-search-form" action="/search">
        <label htmlFor="search-query">Search articles</label>
        <div><input id="search-query" type="search" name="q" maxLength={100} defaultValue={query} placeholder="Try application security or Linux" /><button className="primary-button" type="submit">Search</button></div>
      </form>
      {query && <ArticleCards articles={articles} emptyMessage="No published articles matched your search." />}
    </PublicPage>
  );
}

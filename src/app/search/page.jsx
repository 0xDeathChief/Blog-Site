import ArticleDiscovery from "@/components/public/ArticleDiscovery";
import PublicPage from "@/components/public/PublicPage";
import {
  getArticleDiscoveryOptions,
  getPublishedArticlePage,
  parseArticleDiscoveryFilters,
} from "@/lib/articles/public";

export const metadata = { title: "Search — CipherBrief" };
export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }) {
  const params = await searchParams;
  const filters = parseArticleDiscoveryFilters(params);
  const [results, options] = await Promise.all([
    getPublishedArticlePage(filters),
    getArticleDiscoveryOptions(),
  ]);
  return (
    <PublicPage kicker="SEARCH" title="Search the publication" description={filters.query ? `Results for “${filters.query}”.` : "Search and filter published articles by topic, difficulty, author, or popularity."}>
      <ArticleDiscovery results={results} filters={filters} options={options} action="/search" emptyMessage="No published articles matched those filters." />
    </PublicPage>
  );
}

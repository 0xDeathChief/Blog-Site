import ArticleDiscovery from "@/components/public/ArticleDiscovery";
import PublicPage from "@/components/public/PublicPage";
import {
  getArticleDiscoveryOptions,
  getPublishedArticlePage,
  parseArticleDiscoveryFilters,
} from "@/lib/articles/public";

export const metadata = { title: "Articles — CipherBrief" };
export const dynamic = "force-dynamic";

export default async function ArticlesListingPage({ searchParams }) {
  const params = await searchParams;
  const filters = parseArticleDiscoveryFilters(params);
  const [results, options] = await Promise.all([
    getPublishedArticlePage(filters),
    getArticleDiscoveryOptions(),
  ]);
  return (
    <PublicPage kicker="THE BRIEF" title="Security writing, carefully reviewed." description="Browse practical guides and research shared by the CipherBrief community.">
      <ArticleDiscovery results={results} filters={filters} options={options} action="/articles" />
    </PublicPage>
  );
}

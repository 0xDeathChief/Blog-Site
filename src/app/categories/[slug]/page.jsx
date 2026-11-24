import { notFound } from "next/navigation";
import ArticleDiscovery from "@/components/public/ArticleDiscovery";
import PublicPage from "@/components/public/PublicPage";
import {
  getArticleDiscoveryOptions,
  getPublishedArticlePage,
  parseArticleDiscoveryFilters,
} from "@/lib/articles/public";

export const dynamic = "force-dynamic";

export default async function CategoryPage({ params, searchParams }) {
  const [{ slug }, queryParams] = await Promise.all([params, searchParams]);
  const options = await getArticleDiscoveryOptions();
  const category = options.categories.find((item) => item.slug === slug);
  if (!category) notFound();
  const filters = { ...parseArticleDiscoveryFilters(queryParams), categorySlug: slug };
  const results = await getPublishedArticlePage(filters);
  return (
    <PublicPage kicker="CATEGORY" title={category.name} description={`${category.articleCount} published ${category.articleCount === 1 ? "article" : "articles"} in this topic.`}>
      <ArticleDiscovery results={results} filters={filters} options={options} action="/articles" />
    </PublicPage>
  );
}

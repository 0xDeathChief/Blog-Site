import { notFound } from "next/navigation";
import ArticleDiscovery from "@/components/public/ArticleDiscovery";
import PublicPage from "@/components/public/PublicPage";
import {
  getArticleDiscoveryOptions,
  getPublishedArticlePage,
  parseArticleDiscoveryFilters,
} from "@/lib/articles/public";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params, searchParams }) {
  const [{ slug }, queryParams] = await Promise.all([params, searchParams]);
  const { categories } = await getArticleDiscoveryOptions();
  const category = categories.find((item) => item.slug === slug);
  if (!category) {
    return { title: "Category not found — MadQuill", robots: { index: false, follow: false } };
  }

  const title = `${category.name} Cybersecurity Articles — MadQuill`;
  const description = `Explore ${category.articleCount} published cybersecurity ${category.articleCount === 1 ? "article" : "articles"} in ${category.name}.`;
  const canonical = `/categories/${encodeURIComponent(category.slug)}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: "website", title, description, url: canonical, images: ["/opengraph-image"] },
    robots: Object.keys(queryParams ?? {}).length
      ? { index: false, follow: true }
      : { index: true, follow: true },
  };
}

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

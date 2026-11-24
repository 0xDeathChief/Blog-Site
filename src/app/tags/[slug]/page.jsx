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
  const { tags } = await getArticleDiscoveryOptions();
  const tag = tags.find((item) => item.slug === slug);
  if (!tag) {
    return { title: "Tag not found — CipherBrief", robots: { index: false, follow: false } };
  }

  const title = `${tag.name} Security Articles — CipherBrief`;
  const description = `Browse ${tag.articleCount} published cybersecurity ${tag.articleCount === 1 ? "article" : "articles"} tagged ${tag.name}.`;
  const canonical = `/tags/${encodeURIComponent(tag.slug)}`;
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

export default async function TagPage({ params, searchParams }) {
  const [{ slug }, queryParams] = await Promise.all([params, searchParams]);
  const options = await getArticleDiscoveryOptions();
  const tag = options.tags.find((item) => item.slug === slug);
  if (!tag) notFound();
  const filters = { ...parseArticleDiscoveryFilters(queryParams), tagSlug: slug };
  const results = await getPublishedArticlePage(filters);
  return (
    <PublicPage kicker="TAG" title={tag.name} description={`${tag.articleCount} published ${tag.articleCount === 1 ? "article" : "articles"} tagged with ${tag.name}.`}>
      <ArticleDiscovery results={results} filters={filters} options={options} action="/articles" />
    </PublicPage>
  );
}

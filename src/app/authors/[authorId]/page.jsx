import { notFound } from "next/navigation";
import ArticleDiscovery from "@/components/public/ArticleDiscovery";
import PublicPage from "@/components/public/PublicPage";
import {
  getArticleDiscoveryOptions,
  getPublishedArticlePage,
  getPublicAuthors,
  parseArticleDiscoveryFilters,
} from "@/lib/articles/public";

export const dynamic = "force-dynamic";

export default async function AuthorProfilePage({ params, searchParams }) {
  const [{ authorId }, queryParams] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(authorId)) notFound();
  const [options, authors] = await Promise.all([
    getArticleDiscoveryOptions(),
    getPublicAuthors(authorId),
  ]);
  const author = authors[0];
  if (!author) notFound();
  const filters = { ...parseArticleDiscoveryFilters(queryParams), authorId };
  const results = await getPublishedArticlePage(filters);
  return (
    <PublicPage kicker="AUTHOR PROFILE" title={author.full_name} description={`${author.article_count} published ${author.article_count === 1 ? "article" : "articles"} contributed to CipherBrief.`}>
      <ArticleDiscovery results={results} filters={filters} options={options} action="/articles" emptyMessage="This author has no published articles yet." />
    </PublicPage>
  );
}

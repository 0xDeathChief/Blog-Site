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

export async function generateMetadata({ params, searchParams }) {
  const [{ authorId }, queryParams] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(authorId)) {
    return { title: "Author not found — MadQuill", robots: { index: false, follow: false } };
  }
  const authors = await getPublicAuthors(authorId);
  const author = authors[0];
  if (!author) {
    return { title: "Author not found — MadQuill", robots: { index: false, follow: false } };
  }

  const title = `${author.full_name} — Cybersecurity Author | MadQuill`;
  const description = `Read ${author.article_count} published ${author.article_count === 1 ? "article" : "articles"} by ${author.full_name} on cybersecurity and security research.`;
  const canonical = `/authors/${author.author_id}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "profile",
      title,
      description,
      url: canonical,
      images: author.avatar_url
        ? [{ url: author.avatar_url, alt: author.full_name }]
        : ["/opengraph-image"],
    },
    robots: Object.keys(queryParams ?? {}).length
      ? { index: false, follow: true }
      : { index: true, follow: true },
  };
}

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
    <PublicPage kicker="AUTHOR PROFILE" title={author.full_name} description={`${author.article_count} published ${author.article_count === 1 ? "article" : "articles"} contributed to MadQuill.`}>
      <ArticleDiscovery results={results} filters={filters} options={options} action="/articles" emptyMessage="This author has no published articles yet." />
    </PublicPage>
  );
}

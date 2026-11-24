import { notFound } from "next/navigation";
import ArticleCards from "@/components/public/ArticleCards";
import PublicPage from "@/components/public/PublicPage";
import { getPublishedArticles, getPublicAuthors } from "@/lib/articles/public";

export const dynamic = "force-dynamic";

export default async function AuthorProfilePage({ params }) {
  const { authorId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(authorId)) notFound();
  const [authors, articles] = await Promise.all([
    getPublicAuthors(authorId),
    getPublishedArticles({ authorId }),
  ]);
  const author = authors[0];
  if (!author) notFound();
  return (
    <PublicPage kicker="AUTHOR PROFILE" title={author.full_name} description={`${author.article_count} published ${author.article_count === 1 ? "article" : "articles"} contributed to CipherBrief.`}>
      <ArticleCards articles={articles} emptyMessage="This author has no published articles yet." />
    </PublicPage>
  );
}

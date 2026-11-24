import { notFound } from "next/navigation";
import ArticleCards from "@/components/public/ArticleCards";
import PublicPage from "@/components/public/PublicPage";
import { getPublishedArticles, getPublicTags } from "@/lib/articles/public";

export const dynamic = "force-dynamic";

export default async function TagPage({ params }) {
  const { slug } = await params;
  const [tags, articles] = await Promise.all([
    getPublicTags(),
    getPublishedArticles({ tagSlug: slug }),
  ]);
  const tag = tags.find((item) => item.slug === slug);
  if (!tag) notFound();
  return (
    <PublicPage kicker="TAG" title={tag.name} description={`${tag.articleCount} published ${tag.articleCount === 1 ? "article" : "articles"} tagged with ${tag.name}.`}>
      <ArticleCards articles={articles} />
    </PublicPage>
  );
}

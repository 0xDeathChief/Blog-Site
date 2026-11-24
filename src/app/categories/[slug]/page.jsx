import { notFound } from "next/navigation";
import ArticleCards from "@/components/public/ArticleCards";
import PublicPage from "@/components/public/PublicPage";
import { getPublishedArticles, getPublicCategories } from "@/lib/articles/public";

export const dynamic = "force-dynamic";

export default async function CategoryPage({ params }) {
  const { slug } = await params;
  const [categories, articles] = await Promise.all([
    getPublicCategories(),
    getPublishedArticles({ categorySlug: slug }),
  ]);
  const category = categories.find((item) => item.slug === slug);
  if (!category) notFound();
  return (
    <PublicPage kicker="CATEGORY" title={category.name} description={`${category.articleCount} published ${category.articleCount === 1 ? "article" : "articles"} in this topic.`}>
      <ArticleCards articles={articles} />
    </PublicPage>
  );
}

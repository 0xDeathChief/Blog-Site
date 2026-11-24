import ArticleCards from "@/components/public/ArticleCards";
import PublicPage from "@/components/public/PublicPage";
import { getPublishedArticles } from "@/lib/articles/public";

export const metadata = { title: "Articles — CipherBrief" };
export const dynamic = "force-dynamic";

export default async function ArticlesListingPage() {
  const articles = await getPublishedArticles();
  return (
    <PublicPage kicker="THE BRIEF" title="Security writing, carefully reviewed." description="Browse practical guides and research shared by the CipherBrief community.">
      <ArticleCards articles={articles} />
    </PublicPage>
  );
}

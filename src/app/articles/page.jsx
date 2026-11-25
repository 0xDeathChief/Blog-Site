import ArticleDiscovery from "@/components/public/ArticleDiscovery";
import PublicPage from "@/components/public/PublicPage";
import {
  getArticleDiscoveryOptions,
  getPublishedArticlePage,
  parseArticleDiscoveryFilters,
} from "@/lib/articles/public";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }) {
  const params = await searchParams;
  const hasFilters = Object.keys(params ?? {}).length > 0;
  return {
    title: "Cybersecurity Articles — MadQuill",
    description: "Browse practical cybersecurity guides and research shared by the MadQuill community.",
    alternates: { canonical: "/articles" },
    openGraph: {
      type: "website",
      title: "Cybersecurity Articles — MadQuill",
      description: "Browse practical cybersecurity guides and research shared by the MadQuill community.",
      url: "/articles",
      images: ["/opengraph-image"],
    },
    robots: hasFilters ? { index: false, follow: true } : { index: true, follow: true },
  };
}

export default async function ArticlesListingPage({ searchParams }) {
  const params = await searchParams;
  const filters = parseArticleDiscoveryFilters(params);
  const [results, options] = await Promise.all([
    getPublishedArticlePage(filters),
    getArticleDiscoveryOptions(),
  ]);
  return (
    <PublicPage kicker="THE BRIEF" title="Security writing, carefully reviewed." description="Browse practical guides and research shared by the MadQuill community.">
      <ArticleDiscovery results={results} filters={filters} options={options} action="/articles" />
    </PublicPage>
  );
}

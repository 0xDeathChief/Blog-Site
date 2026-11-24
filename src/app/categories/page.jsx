import DirectoryCards from "@/components/public/DirectoryCards";
import PublicPage from "@/components/public/PublicPage";
import { getPublicCategories } from "@/lib/articles/public";

export const metadata = { title: "Categories — CipherBrief", alternates: { canonical: "/categories" } };
export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await getPublicCategories();
  return (
    <PublicPage kicker="EXPLORE BY TOPIC" title="Categories" description="Explore published writing across security disciplines.">
      <DirectoryCards items={categories} type="categories" />
    </PublicPage>
  );
}

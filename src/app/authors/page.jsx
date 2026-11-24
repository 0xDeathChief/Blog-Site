import DirectoryCards from "@/components/public/DirectoryCards";
import PublicPage from "@/components/public/PublicPage";
import { getPublicAuthors } from "@/lib/articles/public";

export const metadata = { title: "Authors — CipherBrief" };
export const dynamic = "force-dynamic";

export default async function AuthorsPage() {
  const authors = await getPublicAuthors();
  return (
    <PublicPage kicker="COMMUNITY" title="Meet the authors" description="Learn from the people sharing thoughtful security research and practical guides.">
      <DirectoryCards items={authors} type="authors" />
    </PublicPage>
  );
}

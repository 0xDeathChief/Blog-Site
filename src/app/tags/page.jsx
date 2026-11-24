import DirectoryCards from "@/components/public/DirectoryCards";
import PublicPage from "@/components/public/PublicPage";
import { getPublicTags } from "@/lib/articles/public";

export const metadata = { title: "Tags — CipherBrief" };
export const dynamic = "force-dynamic";

export default async function TagsPage() {
  const tags = await getPublicTags();
  return (
    <PublicPage kicker="EXPLORE BY KEYWORD" title="Tags" description="Find related articles through their shared topics and techniques.">
      <DirectoryCards items={tags} type="tags" />
    </PublicPage>
  );
}

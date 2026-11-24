import ReaderCollectionPage from "@/components/portal/ReaderCollectionPage";
export const metadata = { title: "Bookmarks — CipherBrief" };
export const dynamic = "force-dynamic";
export default function BookmarksPage() { return <ReaderCollectionPage kind="bookmarks" />; }

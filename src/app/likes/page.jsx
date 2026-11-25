import ReaderCollectionPage from "@/components/portal/ReaderCollectionPage";
export const metadata = { title: "Liked articles — MadQuill" };
export const dynamic = "force-dynamic";
export default function LikesPage() { return <ReaderCollectionPage kind="likes" />; }

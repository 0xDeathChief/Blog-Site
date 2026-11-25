import ReaderCollectionPage from "@/components/portal/ReaderCollectionPage";
export const metadata = { title: "Reading history — MadQuill" };
export const dynamic = "force-dynamic";
export default function ReadingHistoryPage() { return <ReaderCollectionPage kind="reading-history" />; }

import ReaderCollectionPage from "@/components/portal/ReaderCollectionPage";
export const metadata = { title: "Your comments — CipherBrief" };
export const dynamic = "force-dynamic";
export default function CommentsPage() { return <ReaderCollectionPage kind="comments" />; }

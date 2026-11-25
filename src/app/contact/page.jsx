import Link from "next/link";
import { Mail, MessageSquareText } from "lucide-react";
import PublicPage from "@/components/public/PublicPage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Contact — MadQuill", alternates: { canonical: "/contact" } };
export const dynamic = "force-dynamic";

export default async function ContactPage() {
  let contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "";
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_public_contact_email");
    if (error) throw new Error("Unable to load contact details.", { cause: error });
    contactEmail = data || contactEmail;
  }
  return (
    <PublicPage kicker="CONTACT" title="Get in touch." description="Questions about an article, contributing, or the community?">
      <div className="contact-card">
        <span className="directory-avatar"><MessageSquareText size={22} /></span>
        <h2>Contact the MadQuill team</h2>
        {contactEmail
          ? <p><Mail size={17} /> <a href={`mailto:${contactEmail}`}>{contactEmail}</a></p>
          : <p>The team has not configured a public contact address yet. For contributor access, visit <Link href="/sign-in">sign in</Link> or ask the platform owner directly.</p>}
      </div>
    </PublicPage>
  );
}

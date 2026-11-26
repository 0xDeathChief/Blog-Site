import { Mail } from "lucide-react";
import SiteHeader from "@/components/layout/SiteHeader";
import PublicationFooter from "@/components/public/MadQuillPublicationFooter";

export const metadata = {
  title: "Contact | MadQuill",
  description: "Contact the MadQuill team for feedback, editorial inquiries and general questions.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  const address = (process.env.NEXT_PUBLIC_CONTACT_EMAIL || "").trim();
  const email = /^[^\s@?&#:]+@[^\s@?&#:]+\.[^\s@?&#:]+$/.test(address) ? address : null;
  return (
    <main className="mq-page">
      <SiteHeader />
      <section className="mq-page-content" aria-labelledby="mq-contact-heading">
        <div className="mq-page-heading">
          <span className="section-kicker">GET IN TOUCH</span>
          <h1 id="mq-contact-heading">Contact MadQuill</h1>
          <p>Have a question, an article idea or feedback about the platform? We would like to hear from you.</p>
        </div>
        <article className="contact-card mq-contact-card">
          <span className="mq-contact-symbol"><Mail size={24} aria-hidden="true" /></span>
          <h2>Email us</h2>
          <p>For general inquiries, editorial questions, collaboration and feedback, contact us by email.</p>
          {email ? <a href={`mailto:${email}`}>{email}</a> : <p>Our public contact email will be available soon.</p>}
        </article>
      </section>
      <PublicationFooter />
    </main>
  );
}

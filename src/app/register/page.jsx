import Link from "next/link";
import { ShieldCheck, UserRoundPlus } from "lucide-react";

export const metadata = { title: "Registration — CipherBrief" };

export default function RegistrationPage() {
  return (
    <main className="auth-page">
      <Link className="brand auth-brand" href="/"><span className="brand-mark"><ShieldCheck size={17} /></span><span>CIPHER<span>BRIEF</span></span></Link>
      <section className="auth-card">
        <span className="section-kicker">JOIN THE COMMUNITY</span>
        <h1>Accounts are invitation-only.</h1>
        <p>CipherBrief does not accept public self-registration. The owner invites contributors, editors, and readers to protect the publication and its community.</p>
        <div className="auth-notice"><UserRoundPlus size={19} /><span>Already received an invitation? Follow the secure link in your email to activate your account.</span></div>
        <Link className="primary-button auth-action-link" href="/sign-in">Continue to sign in</Link>
      </section>
    </main>
  );
}

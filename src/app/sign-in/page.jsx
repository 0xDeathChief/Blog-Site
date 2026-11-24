import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import SignInForm from "@/components/auth/SignInForm";

export const metadata = { title: "Sign in — CipherBrief" };

export default function SignInPage() {
  return (
    <main className="auth-page">
      <Link className="brand auth-brand" href="/">
        <span className="brand-mark"><ShieldCheck size={17} /></span>
        <span>CIPHER<span>BRIEF</span></span>
      </Link>
      <section className="auth-card">
        <span className="section-kicker">CONTRIBUTOR ACCESS</span>
        <h1>Welcome back.</h1>
        <p>Sign in to draft, review, or manage articles for CipherBrief.</p>
        <SignInForm />
      </section>
    </main>
  );
}

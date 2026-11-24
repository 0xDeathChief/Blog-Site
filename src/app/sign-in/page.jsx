import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import SignInForm from "@/components/auth/SignInForm";

export const metadata = { title: "Sign in — CipherBrief" };

export default async function SignInPage({ searchParams }) {
  const params = await searchParams;
  return (
    <main className="auth-page">
      <Link className="brand auth-brand" href="/">
        <span className="brand-mark"><ShieldCheck size={17} /></span>
        <span>CIPHER<span>BRIEF</span></span>
      </Link>
      <section className="auth-card">
        <span className="section-kicker">COMMUNITY ACCESS</span>
        <h1>Welcome back.</h1>
        <p>Sign in to continue learning, contributing, reviewing, or managing CipherBrief.</p>
        {params?.updated === "1" && <p className="form-success" role="status">Your password has been updated. Sign in with the new password.</p>}
        {params?.error === "recovery" && <p className="form-error" role="alert">That recovery link is invalid or expired. Request a new one to continue.</p>}
        <SignInForm />
        <div className="auth-page-links">
          <Link href="/forgot-password">Forgot your password?</Link>
          <Link href="/register">How to get an account</Link>
        </div>
      </section>
    </main>
  );
}

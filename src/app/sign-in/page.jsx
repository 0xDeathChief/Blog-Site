import ThemeToggle from "@/components/layout/ThemeToggle";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import SignInForm from "@/components/auth/SignInForm";

export const metadata = { title: "Sign in — MadQuill" };

export default async function SignInPage({ searchParams }) {
  const params = await searchParams;
  return (
    <main className="auth-page">
      <Link className="brand auth-brand" href="/">
        <span className="brand-mark"><img src="/branding/madquill-icon.png" alt="" width={36} height={36} /></span>
        <span>Mad<span>Quill</span></span>
      </Link>
      <div className="cb-auth-theme"><ThemeToggle /></div>
      <section className="auth-card">
        <span className="section-kicker">COMMUNITY ACCESS</span>
        <h1>Welcome back.</h1>
        <p>Sign in to continue learning, contributing, reviewing, or managing MadQuill.</p>
        {params?.updated === "1" && <p className="form-success" role="status">Your password has been updated. Sign in with the new password.</p>}
        {params?.error === "recovery" && <p className="form-error" role="alert">That recovery link is invalid or expired. Request a new one to continue.</p>}
        {process.env.APP_MODE === "preview" ? <p role="status">Local preview: account access is disabled until the new database is connected.</p> : <SignInForm />}
        <div className="auth-page-links">
          <Link href="/forgot-password">Forgot your password?</Link>
          <Link href="/register">Create an account</Link>
        </div>
      </section>
    </main>
  );
}

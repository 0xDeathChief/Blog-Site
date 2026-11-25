import ThemeToggle from "@/components/layout/ThemeToggle";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export const metadata = { title: "Forgot password — MadQuill" };

export default function ForgotPasswordPage() {
  return (
    <main className="auth-page">
      <Link className="brand auth-brand" href="/"><span className="brand-mark"><img src="/branding/madquill-icon.png" alt="" width={36} height={36} /></span><span>Mad<span>Quill</span></span></Link>
      <div className="cb-auth-theme"><ThemeToggle /></div>
      <section className="auth-card">
        <span className="section-kicker">ACCOUNT RECOVERY</span>
        <h1>Reset your password.</h1>
        <p>Enter your account email and we’ll send a secure recovery link if it matches an account.</p>
        <ForgotPasswordForm />
        <Link className="auth-secondary-link" href="/sign-in">Back to sign in</Link>
      </section>
    </main>
  );
}

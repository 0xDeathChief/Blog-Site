import ThemeToggle from "@/components/layout/ThemeToggle";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export const metadata = { title: "Choose a new password — MadQuill" };

export default function ResetPasswordPage() {
  return (
    <main className="auth-page">
      <Link className="brand auth-brand" href="/"><span className="brand-mark"><img src="/branding/madquill-icon.png" alt="" width={36} height={36} /></span><span>Mad<span>Quill</span></span></Link>
      <div className="cb-auth-theme"><ThemeToggle /></div>
      <section className="auth-card">
        <span className="section-kicker">SECURE YOUR ACCOUNT</span>
        <h1>Choose a new password.</h1>
        <p>Use at least 12 characters. Your recovery link must be current.</p>
        <ResetPasswordForm />
      </section>
    </main>
  );
}

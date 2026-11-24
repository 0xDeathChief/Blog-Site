import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export const metadata = { title: "Choose a new password — CipherBrief" };

export default function ResetPasswordPage() {
  return (
    <main className="auth-page">
      <Link className="brand auth-brand" href="/"><span className="brand-mark"><ShieldCheck size={17} /></span><span>CIPHER<span>BRIEF</span></span></Link>
      <section className="auth-card">
        <span className="section-kicker">SECURE YOUR ACCOUNT</span>
        <h1>Choose a new password.</h1>
        <p>Use at least 12 characters. Your recovery link must be current.</p>
        <ResetPasswordForm />
      </section>
    </main>
  );
}

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export const metadata = { title: "Forgot password — CipherBrief" };

export default function ForgotPasswordPage() {
  return (
    <main className="auth-page">
      <Link className="brand auth-brand" href="/"><span className="brand-mark"><ShieldCheck size={17} /></span><span>CIPHER<span>BRIEF</span></span></Link>
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

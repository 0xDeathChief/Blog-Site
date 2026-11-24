import Link from "next/link";

export const metadata = { title: "Access denied — CipherBrief" };

export default function AccessDeniedPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <span className="section-kicker">ACCESS CONTROL</span>
        <h1>This workspace is restricted.</h1>
        <p>Your current account does not have permission to access article management.</p>
        <Link className="primary-button" href="/">Return to CipherBrief</Link>
      </section>
    </main>
  );
}

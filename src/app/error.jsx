"use client";

import { AlertCircle, RefreshCw } from "lucide-react";

export default function Error({ reset }) {
  return (
    <main className="error-page">
      <section className="error-card" role="alert">
        <span className="error-icon"><AlertCircle size={23} /></span>
        <span className="section-kicker">SOMETHING WENT WRONG</span>
        <h1>We couldn’t load this page.</h1>
        <p>Please try again. If the problem continues, come back in a little while.</p>
        <button className="btn btn-primary primary-button" type="button" onClick={reset}>
          <RefreshCw size={16} /> Try again
        </button>
      </section>
    </main>
  );
}

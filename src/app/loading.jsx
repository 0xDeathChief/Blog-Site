export default function Loading() {
  return (
    <main className="loading-page" aria-busy="true" aria-live="polite">
      <div className="shell">
        <span className="section-kicker">CIPHERBRIEF</span>
        <div className="skeleton loading-title" />
        <div className="loading-grid">
          {[0, 1, 2].map((item) => (
            <article className="loading-card" key={item}>
              <div className="skeleton loading-art" />
              <div className="skeleton loading-line" />
              <div className="skeleton loading-line short" />
              <div className="skeleton loading-line small" />
            </article>
          ))}
        </div>
        <span className="sr-only">Loading articles</span>
      </div>
    </main>
  );
}

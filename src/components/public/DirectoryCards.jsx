import Link from "next/link";

export default function DirectoryCards({ items, type }) {
  if (!items.length) {
    return <div className="empty-state public-empty-state"><strong>Nothing to show yet.</strong><p>Check back as the CipherBrief community grows.</p></div>;
  }

  return (
    <div className="directory-grid">
      {items.map((item) => {
        const href = type === "authors"
          ? `/authors/${item.author_id}`
          : `/${type}/${item.slug}`;
        const countLabel = type === "authors" ? "published articles" : "articles";
        const count = item.articleCount ?? item.article_count ?? 0;
        return (
          <Link className="directory-card" href={href} key={item.id ?? item.author_id}>
            <span className="directory-avatar" aria-hidden="true">
              {type === "authors" ? (item.full_name?.charAt(0) ?? "C").toUpperCase() : item.name?.charAt(0).toUpperCase()}
            </span>
            <strong>{item.full_name ?? item.name}</strong>
            <span>{count} {countLabel}</span>
          </Link>
        );
      })}
    </div>
  );
}

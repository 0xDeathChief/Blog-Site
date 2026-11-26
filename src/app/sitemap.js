import {
  getPublicArticleSitemapEntries,
  getPublicAuthors,
  getPublicCategories,
  getPublicTags,
} from "@/lib/articles/public";
import { getSiteUrl } from "@/lib/seo/site";

export const revalidate = 3600;

const publicPages = [
  ["/", 1],
  ["/articles", 0.9],
  ["/trending", 0.8],
  ["/categories", 0.7],
  ["/tags", 0.7],
  ["/authors", 0.7],
  ["/about", 0.5],
  ["/contact", 0.4],
  ["/privacy", 0.2],
  ["/terms", 0.2],
];

export default async function sitemap() {
  const siteUrl = getSiteUrl();
  const [articles, categories, tags, authors] = await Promise.all([
    getPublicArticleSitemapEntries(),
    getPublicCategories(),
    getPublicTags(),
    getPublicAuthors(),
  ]);
  const entries = [
    ...publicPages.map(([path, priority]) => ({
      url: new URL(path, siteUrl).toString(),
      changeFrequency: path === "/" ? "daily" : "weekly",
      priority,
    })),
    ...articles.map((article) => ({
      url: new URL(`/articles/${encodeURIComponent(article.slug)}`, siteUrl).toString(),
      lastModified: article.updated_at || article.published_at,
      changeFrequency: "monthly",
      priority: 0.8,
      ...((typeof article.cover_image === "string" && /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|avif)$/.test(article.cover_image))
        ? { images: [new URL(`/api/article-media/${article.cover_image}?preview=1`, siteUrl).toString()] } : {}),
    })),
    ...categories.map((category) => ({
      url: new URL(`/categories/${encodeURIComponent(category.slug)}`, siteUrl).toString(),
      changeFrequency: "weekly",
      priority: 0.6,
    })),
    ...tags.map((tag) => ({
      url: new URL(`/tags/${encodeURIComponent(tag.slug)}`, siteUrl).toString(),
      changeFrequency: "weekly",
      priority: 0.5,
    })),
    ...authors.map((author) => ({
      url: new URL(`/authors/${author.author_id}`, siteUrl).toString(),
      changeFrequency: "monthly",
      priority: 0.5,
    })),
  ];

  if (entries.length > 50000) {
    throw new Error("The sitemap exceeds the 50,000 URL limit; split it into multiple sitemaps.");
  }
  return entries;
}

import { getSiteUrl } from "@/lib/seo/site";

export const revalidate = 3600;

export default function robots() {
  const siteUrl = getSiteUrl();
  return {
    rules: [{
      userAgent: "*",
      allow: ["/", "/api/article-media/"],
      disallow: [
        "/admin",
        "/dashboard",
        "/editor",
        "/profile",
        "/bookmarks",
        "/likes",
        "/comments",
        "/reading-history",
        "/api/",
      ],
    }],
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
    host: siteUrl.host,
  };
}

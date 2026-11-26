/** @type {import('next').NextConfig} */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const remotePatterns = [];

if (supabaseUrl) {
  const storageUrl = new URL(supabaseUrl);
  remotePatterns.push({
    protocol: storageUrl.protocol.slice(0, -1),
    hostname: storageUrl.hostname,
    port: storageUrl.port,
    pathname: "/storage/v1/object/public/article-covers/**",
  });
}

if (process.env.APP_MODE === "preview" && process.env.NODE_ENV === "production") {
  throw new Error("Preview mode cannot be deployed as production.");
}
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
      ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), hid=(), browsing-topics=()" },
      ...(process.env.APP_MODE === "preview" ? [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] : []),
    ] }, { source: "/branding/madquill-icon-v2.webp", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] }, ...["admin", "dashboard", "editor", "profile", "bookmarks", "likes", "comments", "reading-history", "sign-in", "register", "forgot-password", "reset-password", "access-denied", "auth"].map(route => ({
      source: `/${route}/:path*`, headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Cache-Control", value: "private, no-store" }],
    })), ...["admin", "reader", "profile", "guest"].map(route => ({
      source: `/api/${route}/:path*`, headers: [{ key: "Cache-Control", value: "private, no-store" }],
    }))];
  },
};
nextConfig.images = { remotePatterns };

export default nextConfig;

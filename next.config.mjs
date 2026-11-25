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
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ...(process.env.APP_MODE === "preview" ? [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] : []),
    ] }];
  },
};
nextConfig.images = { remotePatterns };

export default nextConfig;

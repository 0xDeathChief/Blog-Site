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

const nextConfig = {};
nextConfig.images = { remotePatterns };

export default nextConfig;

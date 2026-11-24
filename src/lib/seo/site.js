const defaultSiteUrl = "http://localhost:3000";

export function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL || defaultSiteUrl;
  let url;

  try {
    url = new URL(configuredUrl);
  } catch (error) {
    throw new Error("NEXT_PUBLIC_SITE_URL must be an absolute HTTP or HTTPS URL.", { cause: error });
  }

  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("NEXT_PUBLIC_SITE_URL must be an absolute HTTP or HTTPS URL without credentials.");
  }

  return new URL("/", url);
}

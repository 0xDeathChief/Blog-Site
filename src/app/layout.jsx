import { Geist, Geist_Mono } from "next/font/google";
import { getPublicSiteMetadata } from "@/lib/seo/public";
import { getSiteUrl } from "@/lib/seo/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const defaultMetadata = {
  title: "CipherBrief — Cybersecurity Intelligence",
  description: "Clear security research, practical guides, and community insights.",
};

export async function generateMetadata() {
  const settings = await getPublicSiteMetadata();
  const title = settings.site_title || defaultMetadata.title;
  const description = settings.site_description || defaultMetadata.description;
  const image = "/opengraph-image";

  return {
    metadataBase: getSiteUrl(),
    title,
    description,
    applicationName: title,
    openGraph: {
      type: "website",
      siteName: title,
      title,
      description,
      images: [{ url: image, width: 1200, height: 630, alt: `${title} publication cover` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large" },
    },
  };
}

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

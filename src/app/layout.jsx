import { Geist, Geist_Mono } from "next/font/google";
import { getPublicSiteMetadata } from "@/lib/seo/public";
import { getSiteUrl } from "@/lib/seo/site";
import "./globals.css";
import EditorialMotion from "@/components/layout/EditorialMotion";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const defaultMetadata = {
  title: "MadQuill — Cybersecurity, Research & Technology",
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
      index: process.env.APP_MODE !== "preview",
      follow: true,
      googleBot: { index: process.env.APP_MODE !== "preview", follow: true, "max-image-preview": "large" },
    },
  };
}

// Fixed, user-independent script runs before body paint. Allow its hash in a future CSP.
const themeBoot = `(function(){var t;try{t=localStorage.getItem('cipherbrief-theme')}catch(e){}if(t!=='dark'&&t!=='light'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t})()`;

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head><script dangerouslySetInnerHTML={{ __html: themeBoot }} /></head>
      <body className="min-h-full flex flex-col">{process.env.APP_MODE === "preview" && <div className="local-preview-banner">Local preview · Database disconnected · Account actions disabled</div>}{children}<EditorialMotion /></body>
    </html>
  );
}

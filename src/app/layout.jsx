import { Geist, Geist_Mono } from "next/font/google";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return defaultMetadata;
  }
  const supabase = await createSupabaseServerClient();
  const { data: settings, error } = await supabase.rpc("get_public_site_metadata");
  if (error) throw new Error("Unable to load public site metadata.", { cause: error });
  return {
    title: settings?.site_title || defaultMetadata.title,
    description: settings?.site_description || defaultMetadata.description,
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

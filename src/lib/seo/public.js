import "server-only";

import { unstable_cache } from "next/cache";
import { createSupabasePublicClient } from "@/lib/supabase/public";

const loadPublicSiteMetadata = unstable_cache(async () => {
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase.rpc("get_public_site_metadata");
  if (error) throw new Error("Unable to load public site metadata.", { cause: error });
  return data ?? {};
}, ["public-site-metadata-v1"], {
  revalidate: 3600,
  tags: ["site-settings"],
});

export async function getPublicSiteMetadata() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return {};
  }
  return loadPublicSiteMetadata();
}

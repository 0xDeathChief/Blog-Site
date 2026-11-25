import { z } from "zod";

const supabaseConfigSchema = z.object({
  url: z.string().url(),
  publishableKey: z.string().min(1),
});

export function getSupabaseConfig() {
  if (process.env.APP_MODE === "preview") throw new Error("Database unavailable in local preview.");
  const result = supabaseConfigSchema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  if (!result.success) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return result.data;
}

import "server-only";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getSupabaseConfig } from "./config";

const secretKeySchema = z.string().trim().regex(/^sb_secret_[A-Za-z0-9_-]+$/);

export function createSupabaseAdminClient() {
  const { url } = getSupabaseConfig();
  const result = secretKeySchema.safeParse(process.env.SUPABASE_SECRET_KEY);

  if (!result.success) {
    throw new Error("Set SUPABASE_SECRET_KEY for server-only administrative operations.");
  }

  return createClient(url, result.data, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

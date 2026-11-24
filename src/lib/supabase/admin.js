import "server-only";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getSupabaseConfig } from "./config";

const serviceRoleKeySchema = z.string().min(1);

export function createSupabaseAdminClient() {
  const { url } = getSupabaseConfig();
  const result = serviceRoleKeySchema.safeParse(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!result.success) {
    throw new Error("Set SUPABASE_SERVICE_ROLE_KEY for owner-only account management.");
  }

  return createClient(url, result.data, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

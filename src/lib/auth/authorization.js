import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const APP_ROLES = Object.freeze({
  OWNER: "owner",
  EDITOR: "editor",
  CONTRIBUTOR: "contributor",
  READER: "reader",
});

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication is required.");
    this.name = "AuthenticationRequiredError";
  }
}

export class AuthorizationError extends Error {
  constructor() {
    super("You do not have permission to perform this action.");
    this.name = "AuthorizationError";
  }
}

export async function getCurrentPrincipal() {
  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError) {
    throw new Error("Unable to verify the current session.", { cause: authError });
  }
  if (!authData.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name:full_name, role, status")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error("Unable to load the current user's access profile.", {
      cause: profileError,
    });
  }
  if (!profile || profile.status !== "active") return null;

  return {
    id: profile.id,
    email: authData.user.email ?? null,
    displayName: profile.display_name,
    role: profile.role,
  };
}

export async function requireUser() {
  const principal = await getCurrentPrincipal();
  if (!principal) throw new AuthenticationRequiredError();
  return principal;
}

export async function requireRole(...allowedRoles) {
  const principal = await requireUser();
  if (!allowedRoles.includes(principal.role)) throw new AuthorizationError();
  return principal;
}

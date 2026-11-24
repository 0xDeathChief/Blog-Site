import "server-only";

import { redirect } from "next/navigation";
import { getCurrentPrincipal } from "@/lib/auth/authorization";

export async function requireArticlePage(allowedRoles, path) {
  const principal = await getCurrentPrincipal();
  if (!principal) {
    redirect(`/sign-in?next=${encodeURIComponent(path)}`);
  }
  if (!allowedRoles.includes(principal.role)) {
    redirect("/access-denied");
  }
  return principal;
}

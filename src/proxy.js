import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function proxy(request) {
  const p = request.nextUrl.pathname;
  const article = p === "/articles" || p.startsWith("/articles/");
  if (process.env.APP_MODE === "preview") {
    // Articles were public in preview before this patch.
    if (article) return NextResponse.next();
    if (p.startsWith("/api/") || p.startsWith("/auth/")) {
      return NextResponse.json({ error: "Database disconnected in local preview." }, { status: 503 });
    }
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
  // API handlers and auth callbacks already have writable cookies.
  if (p === "/api" || p.startsWith("/api/") || p === "/auth" || p.startsWith("/auth/")) return NextResponse.next();
  // No refresh needed for anonymous visitors; avoid an extra auth request.
  if (!request.cookies.getAll().some(({ name }) => /^sb-.+-auth-token(?:\.\d+)?$/.test(name))) return NextResponse.next();
  const { url, publishableKey } = getSupabaseConfig();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, cacheHeaders) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        const next = NextResponse.next({ request });
        for (const cookie of response.cookies.getAll()) next.cookies.set(cookie);
        for (const { name, value, options } of cookiesToSet) next.cookies.set(name, value, options);
        if (cacheHeaders) new Headers(cacheHeaders).forEach((value, key) => {
          if (["cache-control", "expires", "pragma"].includes(key.toLowerCase())) next.headers.set(key, value);
        });
        next.headers.set("Cache-Control", "private, no-store");
        response = next;
      },
    },
  });
  // Refresh/verify before rendering. Existing server-side authorization and
  // database RLS still decide access; this proxy grants no permissions.
  await supabase.auth.getClaims();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: ["/articles/:path*", "/api/:path*", "/auth/:path*", "/admin/:path*", "/dashboard/:path*", "/editor/:path*", "/profile/:path*", "/bookmarks/:path*", "/likes/:path*", "/comments/:path*", "/reading-history/:path*", "/forgot-password/:path*", "/reset-password/:path*"] };

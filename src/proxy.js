import { NextResponse } from "next/server";
export function proxy(request) {
  if (process.env.APP_MODE !== "preview") return NextResponse.next();
  const p = request.nextUrl.pathname;
  if (p.startsWith("/api/") || p.startsWith("/auth/")) {
    return NextResponse.json({error:"Database disconnected in local preview."},{status:503});
  }
  return NextResponse.redirect(new URL("/sign-in", request.url));
}
export const config = { matcher: ["/api/:path*", "/auth/:path*", "/admin/:path*", "/dashboard/:path*", "/editor/:path*", "/profile/:path*", "/bookmarks/:path*", "/likes/:path*", "/comments/:path*", "/reading-history/:path*", "/forgot-password/:path*", "/reset-password/:path*"] };

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedPath = requestUrl.searchParams.get("next") ?? "/";
  const parsedNext = new URL(requestedPath, requestUrl.origin);
  const nextPath = requestedPath.startsWith("/") && parsedNext.origin === requestUrl.origin
    ? `${parsedNext.pathname}${parsedNext.search}${parsedNext.hash}`
    : "/";

  if (!code) {
    return NextResponse.redirect(new URL("/sign-in?error=recovery", requestUrl.origin));
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/sign-in?error=recovery", requestUrl.origin));
  }
  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}

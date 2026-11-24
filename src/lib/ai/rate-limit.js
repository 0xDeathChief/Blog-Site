import "server-only";

import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function checkAiRateLimit(request, userId, {
  bucketPrefix = "ai",
  authenticatedLimit = 20,
  anonymousLimit = 10,
  featureName = "AI assistant",
} = {}) {
  const address = request.headers.get("x-real-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0].trim()
    ?? "shared";
  const subject = userId
    ? `user:${userId}`
    : `ip:${createHash("sha256").update(address).digest("hex")}`;
  let adminClient;
  try {
    adminClient = createSupabaseAdminClient();
  } catch (error) {
    console.error(`${featureName} rate limiting is not configured.`, error);
    return NextResponse.json({ error: "The service is not configured yet." }, { status: 503 });
  }

  const { data: withinLimit, error } = await adminClient.rpc("consume_rate_limit", {
    p_bucket_key: `${bucketPrefix}:${subject}`,
    p_request_limit: userId ? authenticatedLimit : anonymousLimit,
    p_window_seconds: 300,
  });
  if (error) {
    console.error(`${featureName} rate limit could not be enforced.`, error);
    return NextResponse.json({ error: "The service is temporarily unavailable." }, { status: 503 });
  }
  if (!withinLimit) {
    return NextResponse.json(
      { error: "You've reached the request limit. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": "300", "Cache-Control": "no-store" } },
    );
  }
  return null;
}

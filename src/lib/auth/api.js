import { NextResponse } from "next/server";
import {
  AuthenticationRequiredError,
  AuthorizationError,
  requireRole,
} from "./authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function requireOwnerApi(request, { mutating = false } = {}) {
  if (mutating && !isSameOriginRequest(request)) {
    return {
      response: NextResponse.json({ error: "Invalid request origin." }, { status: 403 }),
    };
  }

  let owner;
  try {
    owner = await requireRole("owner");
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return { response: NextResponse.json({ error: error.message }, { status: 401 }) };
    }
    if (error instanceof AuthorizationError) {
      return { response: NextResponse.json({ error: error.message }, { status: 403 }) };
    }
    throw error;
  }

  const adminClient = createSupabaseAdminClient();
  const { data: withinLimit, error: limitError } = await adminClient.rpc(
    "consume_rate_limit",
    {
      p_bucket_key: `admin-users:${owner.id}`,
      p_request_limit: 30,
      p_window_seconds: 300,
    },
  );

  if (limitError) {
    throw new Error("Unable to enforce the owner API rate limit.", { cause: limitError });
  }
  if (!withinLimit) {
    return {
      response: NextResponse.json(
        { error: "Too many account-management requests. Try again shortly." },
        { status: 429, headers: { "Retry-After": "300" } },
      ),
    };
  }

  return { owner, adminClient };
}

export async function readJsonBody(request) {
  try {
    return { body: await request.json() };
  } catch {
    return { response: NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }) };
  }
}

function isSameOriginRequest(request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

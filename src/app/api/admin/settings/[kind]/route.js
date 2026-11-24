import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { requireOwnerApi, readJsonBody } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request, context) {
  const authorization = await requireOwnerApi(request);
  if (authorization.response) return authorization.response;
  const { kind } = await context.params;
  const supabase = await createSupabaseServerClient();
  if (kind === "ai") {
    const { data, error } = await supabase.from("ai_settings").select("model_name, enabled, system_prompt").eq("id", 1).maybeSingle();
    if (error) return NextResponse.json({ error: "Unable to load AI settings." }, { status: 502 });
    return NextResponse.json({ settings: data });
  }
  if (kind === "website") {
    const { data, error } = await supabase.from("site_settings").select("setting_key, setting_value, updated_at").order("setting_key");
    if (error) return NextResponse.json({ error: "Unable to load website settings." }, { status: 502 });
    return NextResponse.json({ settings: data });
  }
  return NextResponse.json({ error: "Unknown settings group." }, { status: 404 });
}

export async function PUT(request, context) {
  const authorization = await requireOwnerApi(request, { mutating: true });
  if (authorization.response) return authorization.response;
  const { kind } = await context.params;
  const parsedBody = await readJsonBody(request, { maxBytes: 8192 });
  if (parsedBody.response) return parsedBody.response;
  const supabase = await createSupabaseServerClient();

  if (kind === "ai") {
    const parsed = z.object({
      modelName: z.string().trim().min(1).max(128),
      enabled: z.boolean(),
    }).strict().safeParse(parsedBody.body);
    if (!parsed.success) return NextResponse.json({ error: "Provide a valid model name and enabled setting." }, { status: 400 });
    const { data, error } = await supabase.from("ai_settings").upsert({
      id: 1,
      model_name: parsed.data.modelName,
      enabled: parsed.data.enabled,
      updated_by: authorization.owner.id,
    }).select("model_name, enabled, system_prompt").single();
    if (error) return NextResponse.json({ error: "Unable to update AI settings." }, { status: 502 });
    return NextResponse.json({ settings: data });
  }

  if (kind === "website") {
    const parsed = z.object({
      settingKey: z.enum(["site_title", "site_description", "contact_email"]),
      value: z.string().trim().max(254),
    }).strict().superRefine((entry, issueContext) => {
      if (entry.settingKey === "contact_email" && entry.value && !z.string().email().safeParse(entry.value).success) {
        issueContext.addIssue({ code: "custom", path: ["value"], message: "Invalid contact email." });
      }
    }).safeParse(parsedBody.body);
    if (!parsed.success) return NextResponse.json({ error: "Check the website setting and value." }, { status: 400 });
    const { data, error } = await supabase.from("site_settings").upsert({
      setting_key: parsed.data.settingKey,
      setting_value: parsed.data.value,
      updated_by: authorization.owner.id,
    }).select("setting_key, setting_value, updated_at").single();
    if (error) return NextResponse.json({ error: "Unable to update the website setting." }, { status: 502 });
    if (parsed.data.settingKey === "site_title" || parsed.data.settingKey === "site_description") {
      revalidateTag("site-settings", "max");
    }
    return NextResponse.json({ setting: data });
  }
  return NextResponse.json({ error: "Unknown settings group." }, { status: 404 });
}

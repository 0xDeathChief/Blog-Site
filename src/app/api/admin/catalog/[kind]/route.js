import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { requireOwnerApi, readJsonBody } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const slugSchema = z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

function getCatalog(kind) {
  if (kind === "categories") return { table: "categories", maxName: 80 };
  if (kind === "tags") return { table: "tags", maxName: 40 };
  return null;
}

export async function GET(request, context) {
  const authorization = await requireOwnerApi(request);
  if (authorization.response) return authorization.response;
  const { kind } = await context.params;
  const catalog = getCatalog(kind);
  if (!catalog) return NextResponse.json({ error: "Unknown catalog." }, { status: 404 });
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from(catalog.table).select("*").order("name");
  if (error) return NextResponse.json({ error: "Unable to load categories or tags." }, { status: 502 });
  return NextResponse.json({ items: data });
}

export async function POST(request, context) {
  const authorization = await requireOwnerApi(request, { mutating: true });
  if (authorization.response) return authorization.response;
  const { kind } = await context.params;
  const catalog = getCatalog(kind);
  if (!catalog) return NextResponse.json({ error: "Unknown catalog." }, { status: 404 });
  const parsedBody = await readJsonBody(request, { maxBytes: 4096 });
  if (parsedBody.response) return parsedBody.response;
  const parsed = z.object({
    name: z.string().trim().min(1).max(catalog.maxName),
    slug: slugSchema,
  }).strict().safeParse(parsedBody.body);
  if (!parsed.success) return NextResponse.json({ error: "Provide a valid name and lowercase URL slug." }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from(catalog.table).insert(parsed.data).select("*").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "That name or slug is already in use." : "Unable to create this item." }, { status: error.code === "23505" ? 409 : 502 });
  revalidateCatalog(kind);
  return NextResponse.json({ item: data }, { status: 201 });
}

export async function PATCH(request, context) {
  const authorization = await requireOwnerApi(request, { mutating: true });
  if (authorization.response) return authorization.response;
  const { kind } = await context.params;
  const catalog = getCatalog(kind);
  if (!catalog) return NextResponse.json({ error: "Unknown catalog." }, { status: 404 });
  const parsedBody = await readJsonBody(request, { maxBytes: 4096 });
  if (parsedBody.response) return parsedBody.response;
  const schema = z.object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(catalog.maxName),
    slug: slugSchema,
    isActive: z.boolean().optional(),
  }).strict();
  const parsed = schema.safeParse(parsedBody.body);
  if (!parsed.success) return NextResponse.json({ error: "Check the name, slug, and category status." }, { status: 400 });
  const { id, isActive, ...values } = parsed.data;
  const update = kind === "categories" && isActive !== undefined ? { ...values, is_active: isActive } : values;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from(catalog.table).update(update).eq("id", id).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "That name or slug is already in use." : "Unable to update this item." }, { status: error.code === "23505" ? 409 : 502 });
  if (!data) return NextResponse.json({ error: "Item not found." }, { status: 404 });
  revalidateCatalog(kind);
  return NextResponse.json({ item: data });
}

export async function DELETE(request, context) {
  const authorization = await requireOwnerApi(request, { mutating: true });
  if (authorization.response) return authorization.response;
  const { kind } = await context.params;
  const catalog = getCatalog(kind);
  if (!catalog) return NextResponse.json({ error: "Unknown catalog." }, { status: 404 });
  const parsedBody = await readJsonBody(request, { maxBytes: 1024 });
  if (parsedBody.response) return parsedBody.response;
  const parsed = z.object({ id: z.string().uuid() }).strict().safeParse(parsedBody.body);
  if (!parsed.success) return NextResponse.json({ error: "Provide a valid item ID." }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from(catalog.table).delete().eq("id", parsed.data.id).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to delete this item." }, { status: 502 });
  if (!data) return NextResponse.json({ error: "Item not found." }, { status: 404 });
  revalidateCatalog(kind);
  return new NextResponse(null, { status: 204 });
}

function revalidateCatalog(kind) {
  revalidateTag(kind === "categories" ? "public-categories" : "public-tags", "max");
  revalidateTag("published-content", "max");
}

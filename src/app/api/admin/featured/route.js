import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { requireOwnerApi, readJsonBody } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request) {
  const authorization = await requireOwnerApi(request, { mutating: true });
  if (authorization.response) return authorization.response;
  const parsedBody = await readJsonBody(request, { maxBytes: 2048 });
  if (parsedBody.response) return parsedBody.response;
  const parsed = z.object({ articleId: z.string().uuid(), featured: z.boolean() }).strict().safeParse(parsedBody.body);
  if (!parsed.success) return NextResponse.json({ error: "Choose an article and featured state." }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_article_featured", {
    target_article_id: parsed.data.articleId,
    featured: parsed.data.featured,
  });
  if (error) return NextResponse.json({ error: "Unable to update featured content." }, { status: error.code === "P0002" ? 404 : 502 });
  revalidateTag("published-content", { expire: 0 });
  return NextResponse.json({ status: "updated" });
}

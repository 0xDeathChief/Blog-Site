import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/api";
import { z } from "zod";

const imageFormats = {
  "image/jpeg": { extension: "jpg", matches: (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  "image/png": { extension: "png", matches: (bytes) => bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  "image/webp": { extension: "webp", matches: (bytes) => bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP" },
  "image/avif": { extension: "avif", matches: (bytes) => bytes.toString("ascii", 4, 12).startsWith("ftypavif") || bytes.toString("ascii", 4, 12).startsWith("ftypavis") },
};

export async function POST(request) {
  const authorization = await requireRoleApi(request, ["owner", "contributor"], { mutating: true });
  if (authorization.response) return authorization.response;

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > 5 * 1024 * 1024 + 128 * 1024) {
    return NextResponse.json({ error: "Cover images must be smaller than 5 MB." }, { status: 413 });
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Select a valid image file." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size < 1 || file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Cover images must be smaller than 5 MB." }, { status: 400 });
  }

  const articleIdValue = formData.get("articleId");
  if (articleIdValue) {
    const articleId = z.string().uuid().safeParse(articleIdValue);
    if (!articleId.success) {
      return NextResponse.json({ error: "Invalid article ID." }, { status: 400 });
    }
    const { data: article, error: articleError } = await authorization.supabase
      .from("articles")
      .select("author_id, status")
      .eq("id", articleId.data)
      .maybeSingle();
    if (articleError) {
      return NextResponse.json({ error: "Unable to verify article access." }, { status: 502 });
    }
    if (!article) {
      return NextResponse.json({ error: "Article not found." }, { status: 404 });
    }
    if (
      authorization.principal.role === "contributor"
      && (
        article.author_id !== authorization.principal.id
        || !["draft", "revision_requested", "rejected"].includes(article.status)
      )
    ) {
      return NextResponse.json({ error: "You cannot change this article's cover image." }, { status: 403 });
    }
  }

  const format = imageFormats[file.type];
  if (!format) {
    return NextResponse.json({ error: "Use a JPEG, PNG, WebP, or AVIF cover image." }, { status: 415 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!format.matches(bytes)) {
    return NextResponse.json({ error: "The image contents do not match the selected file type." }, { status: 415 });
  }

  const path = `${authorization.principal.id}/${randomUUID()}.${format.extension}`;
  const { error: uploadError } = await authorization.supabase.storage
    .from("article-covers")
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: "Unable to upload the cover image." }, { status: 502 });
  }

  const { data } = authorization.supabase.storage.from("article-covers").getPublicUrl(path);
  return NextResponse.json({ path, url: data.publicUrl }, { status: 201 });
}

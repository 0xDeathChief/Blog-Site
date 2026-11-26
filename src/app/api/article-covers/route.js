import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { mediaMode, storeVariants } from "@/lib/media/variants.mjs";
export const runtime="nodejs";
export const maxDuration = 60;
import { after, NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/api";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const imageFormats = {
  "image/jpeg": { extension: "jpg", matches: (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  "image/png": { extension: "png", matches: (bytes) => bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  "image/webp": { extension: "webp", matches: (bytes) => bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP" },
  "image/avif": { extension: "avif", matches: (bytes) => bytes.toString("ascii", 4, 12).startsWith("ftypavif") || bytes.toString("ascii", 4, 12).startsWith("ftypavis") },
};

export async function POST(request) {
  const authorization = await requireRoleApi(request, ["owner", "contributor"], { mutating: true });
  if (authorization.response) return authorization.response;

  const admin = createSupabaseAdminClient();
  const {data:allowed,error:limitError}=await admin.rpc("consume_rate_limit",{p_bucket_key:`media:${authorization.principal.id}`,p_request_limit:15,p_window_seconds:3600});
  if(limitError||allowed!==true)return NextResponse.json({error:"Upload limit reached or unavailable."},{status:limitError?503:429});
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > 5 * 1024 * 1024 + 128 * 1024) {
    return NextResponse.json({ error: "Cover images must be smaller than 5 MB." }, { status: 413 });
  }

  let formData;
  try {
    // Enforce an actual streamed byte limit even when Content-Length is missing.
    const reader=request.body?.getReader(); if(!reader)throw new Error("Missing body");
    const chunks=[];let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
      if(size>5*1024*1024+128*1024){await reader.cancel();return NextResponse.json({error:"Upload is too large."},{status:413});}chunks.push(value);}
    formData=await new Response(Buffer.concat(chunks),{headers:{"Content-Type":request.headers.get("content-type")||""}}).formData();
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

  let output;
  try {
    const pipeline=sharp(bytes,{limitInputPixels:16000000,failOn:"error",animated:false});
    const metadata=await pipeline.metadata();
    if(!metadata.width||!metadata.height||metadata.width>6000||metadata.height>6000||metadata.width*metadata.height>16000000||metadata.pages>1||metadata.depth!=="uchar")
      return NextResponse.json({error:"Use a single-frame 8-bit image of at most 16 megapixels."},{status:415});
    // No resize or lossy quality reduction. Normalize orientation and strip metadata.
    output=await pipeline.rotate().webp({lossless:true,effort:4}).toBuffer();
  } catch {return NextResponse.json({error:"Image cannot be decoded safely. Try a standard JPEG, PNG, or WebP."},{status:415});}
  if(output.length>2*1024*1024)return NextResponse.json({error:"Lossless image exceeds the 2 MB storage limit. Choose a smaller source image; quality was not reduced."},{status:413});
  const path = `${authorization.principal.id}/${randomUUID()}.webp`;
  const { error: uploadError } = await admin.storage
    .from("article-covers")
    .upload(path, output, { contentType: "image/webp", upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: "Unable to upload the cover image." }, { status: 502 });
  }

  // The original upload is authoritative. Variant generation must never
  // invalidate a successful upload, or publish a draft's bytes.
  if (mediaMode() !== "legacy") {
    const sourceType = file.type;
    // Keep the upload response fast. Next.js retains the route lifecycle for
    // this best-effort task; fallback/backfill handle interrupted generation.
    after(async () => {
      try {
        const result = await storeVariants(admin, bytes, path, sourceType);
        if (result.failed) console.warn("[MadQuill media] Some upload variants unavailable", result.failed);
      } catch { console.warn("[MadQuill media] Variant generation unavailable; master retained"); }
    });
  }
  return NextResponse.json({ path, url: `/api/article-media/${path}`,originalBytes:bytes.length,storedBytes:output.length }, { status: 201 });
}

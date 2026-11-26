import sharp from "sharp";
import { VARIANT_BUCKET, MEDIA_KEY, mediaMode, parseWidth, preferredVariants, STORAGE_TTL } from "@/lib/media/variants.mjs";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createHash } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabasePublicClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Public bytes only, never sessions or permission decisions. Every request
// still checks visibility before reading the cache or returning a 304.
const MAX_BYTES = 32 * 1024 * 1024;
const MAX_ITEM = 5 * 1024 * 1024;
const TTL = 60_000;
const cached = new Map();
const pending = new Map();
let cacheBytes = 0;
function remove(key) {
  const entry = cached.get(key);
  if (entry) { cacheBytes -= entry.bytes.length; cached.delete(key); }
}
function lookup(key) {
  const entry = cached.get(key);
  if (!entry) return null;
  if (entry.expires <= Date.now()) { remove(key); return null; }
  cached.delete(key); cached.set(key, entry);
  return entry;
}
function store(key, entry) {
  if (entry.bytes.length > MAX_ITEM) return;
  remove(key);
  for (const [k, v] of cached) if (v.expires <= Date.now()) remove(k);
  while (cached.size >= 128 || cacheBytes + entry.bytes.length > MAX_BYTES) {
    const oldest = cached.keys().next().value;
    if (oldest === undefined) break;
    remove(oldest);
  }
  cached.set(key, { ...entry, expires: Date.now() + TTL });
  cacheBytes += entry.bytes.length;
}
async function shared(key, loader) {
  const hit = lookup(key);
  if (hit) return { entry: hit, status: "HIT" };
  if (pending.has(key)) return { entry: await pending.get(key), status: "COALESCED" };
  // Bound the number of unique outstanding cached operations too.
  if (pending.size >= 32) return { entry: await loader(), status: "BYPASS" };
  const task = Promise.resolve().then(loader).then(entry => {
    if (entry) store(key, entry);
    return entry;
  });
  pending.set(key, task);
  try { return { entry: await task, status: "MISS" }; }
  finally { pending.delete(key); }
}
function payload(bytes, type) {
  return { bytes, type, etag: '"' + createHash("sha256").update(bytes).digest("hex") + '"' };
}
async function download(key) {
  const { data, error } = await createSupabaseAdminClient().storage.from("article-covers").download(key);
  if (error || !data) return null;
  const type = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif" }[key.split(".").pop()];
  return payload(Buffer.from(await data.arrayBuffer()), type);
}
async function preview(original) {
  if (!original) return null;
  try {
    const bytes = await sharp(original.bytes, { limitInputPixels: 16000000, failOn: "error", animated: false })
      .rotate().resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 }).toBuffer();
    if (bytes.length < original.bytes.length) return payload(bytes, "image/webp");
  } catch (error) { console.warn("[MadQuill media] Preview unavailable", error?.name ?? "unknown"); }
  return original;
}
// Sign only published derivatives, never a draft or the original master.
// Cache tokens briefly, but never cache publication decisions. Each caller
// still goes through the public RPC before requesting a redirect.
const signed = new Map();
const signing = new Map();
const MAX_SIGNED = 256;
function validatedSignedUrl(value, path) {
  try {
    const url = new URL(value);
    const origin = new URL(getSupabaseConfig().url).origin;
    if (url.origin !== origin || url.username || url.password ||
        decodeURIComponent(url.pathname) !== `/storage/v1/object/sign/${VARIANT_BUCKET}/${path}` ||
        !url.searchParams.get('token')) return null;
    return url.toString();
  } catch { return null; }
}
async function getSignedVariant(paths) {
  const key = paths.join('|');
  const hit = signed.get(key);
  if (hit && hit.expires > Date.now()) return hit.url;
  signed.delete(key);
  if (signing.has(key)) return signing.get(key);
  const task = (async () => {
    try {
      // One storage request even when AVIF is optional.
      const { data, error } = await createSupabaseAdminClient().storage.from(VARIANT_BUCKET).createSignedUrls(paths, STORAGE_TTL);
      if (error || !Array.isArray(data)) return null;
      let url = null;
      for (const path of paths) {
        const item = data.find(v => v.path === path && !v.error && v.signedUrl);
        if (item) { url = validatedSignedUrl(item.signedUrl, path); if (url) break; }
      }
      if (signed.size >= MAX_SIGNED) signed.delete(signed.keys().next().value);
      signed.set(key, {url, expires:Date.now() + (url ? 20_000 : 10_000)});
      return url;
    } catch { return null; }
  })();
  if (signing.size >= 32) return task;
  signing.set(key, task);
  try { return await task; } finally { signing.delete(key); }
}
async function loadVariant(paths) {
  const bucket = createSupabaseAdminClient().storage.from(VARIANT_BUCKET);
  for (const path of paths) {
    try {
      const { data, error } = await bucket.download(path);
      if (!error && data) return payload(Buffer.from(await data.arrayBuffer()), path.endsWith('.avif') ? 'image/avif' : 'image/webp');
    } catch { /* Legacy original remains available. */ }
  }
  return null;
}
function missing() {
  return new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } });
}
export async function GET(request, { params }) {
  const { path } = await params;
  const key = path.join("/");
  if (!MEDIA_KEY.test(key)) return missing();
  const mode = mediaMode();
  const paramsUrl = new URL(request.url).searchParams;
  const isPreview = paramsUrl.get('preview') === '1';
  const explicitWidth = paramsUrl.has('w');
  const width = parseWidth(paramsUrl.get('w'));
  const accept = request.headers.get('accept') || '';
  const publicClient = createSupabasePublicClient();
  let verifiedPublished = false;
  let publicCheck;
  if (mode !== 'legacy') {
    try {
      publicCheck = await publicClient.rpc('mq_media_published', { p_path: key });
      verifiedPublished = !publicCheck.error && publicCheck.data === true;
    } catch { publicCheck = null; }
  }
  // A missing migration must not break existing article media. Never use
  // the legacy check as permission to mint a signed variant URL.
  if (!publicCheck || publicCheck.error) publicCheck = await publicClient.rpc('cb_media_visible', { p_path: key });
  const publicImage = !publicCheck.error && publicCheck.data === true;
  if (isPreview && !publicImage) return missing();
  if (!publicImage) {
    const client = await createSupabaseServerClient();
    const { data: allowed, error } = await client.rpc('cb_media_visible', { p_path: key });
    if (error || allowed !== true) return missing();
  }
  let entry, status;
  if (publicImage) {
    if (isPreview && verifiedPublished) {
      // SEO/social crawler URL stays a stable, same-origin 200 response.
      const paths = preferredVariants(key, width, explicitWidth ? accept : '');
      if (mode === 'cdn' && explicitWidth) {
        const url = await getSignedVariant(paths);
        if (url) return new Response(null, { status: 307, headers: {
          Location: url, 'Cache-Control': 'private, no-store', Vary: 'Accept, Cookie',
          'Referrer-Policy': 'no-referrer', 'X-MadQuill-Media-Cache': 'CDN-REDIRECT',
        }});
        // Missing variant: fall through to the previous, known-good original path.
      } else {
        const result = await shared(`v2:${paths.join('|')}`, () => loadVariant(paths));
        if (result.entry) { entry = result.entry; status = `VARIANT-${result.status}`; }
      }
    }
    if (!entry) {
      const original = () => shared(`original:${key}`, () => download(key));
      const result = isPreview
        ? await shared(`preview:${key}`, async () => preview((await original()).entry))
        : await original();
      ({ entry, status } = result);
    }
  } else {
    // No variants, signed redirects, shared bytes, or 304 responses for drafts.
    entry = await download(key); status = 'PRIVATE';
  }
  if (!entry) return missing();
  const headers = {
    "Content-Type": entry.type,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": publicImage ? (mode === "proxy" ? "private, no-cache" : "private, max-age=60, must-revalidate") : "private, no-store",
    "Vary": "Accept, Cookie",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "X-MadQuill-Media-Cache": status,
    ...(publicImage ? { ETag: entry.etag } : { "X-Robots-Tag": "noindex" }),
  };
  const tags = (request.headers.get("if-none-match") || "").split(",").map(v => v.trim().replace(/^W\//, ""));
  if (publicImage && (tags.includes(entry.etag) || tags.includes("*"))) return new Response(null, { status: 304, headers });
  return new Response(entry.bytes, { headers: { ...headers, "Content-Length": String(entry.bytes.length) } });
}

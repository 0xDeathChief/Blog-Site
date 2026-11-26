import sharp from 'sharp';

// Private, server-managed bucket. The original article-covers bucket and
// canonical article content paths never change.
export const VARIANT_BUCKET = 'madquill-media-variants';
export const WIDTHS = Object.freeze([320, 640, 1200, 1920]);
export const MEDIA_KEY = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|avif)$/;
export const MAX_VARIANT_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;
export const STORAGE_TTL = 60;
export function mediaMode() {
  const mode = process.env.MADQUILL_MEDIA_MODE;
  return mode === 'proxy' || mode === 'cdn' ? mode : 'legacy';
}
export function parseWidth(value) {
  return WIDTHS.includes(Number(value)) && String(Number(value)) === value ? Number(value) : 1200;
}
export function variantPath(key, width, format) {
  if (!MEDIA_KEY.test(key) || !WIDTHS.includes(width) || !['webp', 'avif'].includes(format)) throw new Error('Invalid variant path');
  return `v1/${key}/${width}.${format}`;
}
export function preferredVariants(key, width, accept = '') {
  const paths = [];
  // AVIF is optional: a missing AVIF never causes a broken image.
  if (accept.split(',').some(part => part.trim().toLowerCase().split(';')[0].trim() === 'image/avif' && !part.split(';').slice(1).some(param => /^\s*q\s*=\s*0(?:\.0*)?\s*$/i.test(param))) && width !== 320) paths.push(variantPath(key, width, 'avif'));
  paths.push(variantPath(key, width, 'webp'));
  return paths;
}
export function isPhotographic(metadata, sourceType) {
  // Conservative: do not guess that technical screenshots are photographs.
  return !metadata.hasAlpha && sourceType === 'image/jpeg';
}
function safePipeline(bytes) {
  return sharp(bytes, { limitInputPixels: 16000000, failOn: 'error', animated: false });
}
export async function generateVariants(bytes, key, sourceType, write, existing = new Set()) {
  if (!MEDIA_KEY.test(key)) throw new Error('Invalid original media path');
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error('Unsupported original image size');
  const meta = await safePipeline(bytes).metadata();
  if (!meta.width || !meta.height || meta.width > 6000 || meta.height > 6000 || meta.width * meta.height > 16000000 || meta.pages > 1 || meta.depth !== 'uchar') throw new Error('Unsupported original image');
  const photo = isPhotographic(meta, sourceType);
  let stored = 0, bytesStored = 0, skipped = 0, failed = 0;
  // Generate sequentially to bound native memory and CPU on serverless instances.
  for (const width of WIDTHS) {
    const path = variantPath(key, width, 'webp');
    let webp;
    try {
      if (!existing.has(path)) {
        webp = await safePipeline(bytes).rotate().resize({ width, withoutEnlargement: true })
          .webp(photo ? { quality: 86, effort: 3 } : { lossless: true, effort: 3 }).toBuffer();
        if (webp.length > MAX_VARIANT_BYTES || bytesStored + webp.length > MAX_TOTAL_BYTES) { skipped++; continue; }
        await write(path, webp, 'image/webp'); stored++; bytesStored += webp.length;
      } else skipped++;
      // Only photographic sources get lossy AVIF; retain it only if it is
      // substantially smaller than the already generated WebP.
      if (photo && width !== 320 && webp && !existing.has(variantPath(key, width, 'avif'))) {
        const avif = await safePipeline(bytes).rotate().resize({ width, withoutEnlargement: true }).avif({ quality: 66, effort: 2 }).toBuffer();
        if (avif.length < webp.length * 0.9 && avif.length <= MAX_VARIANT_BYTES && bytesStored + avif.length <= MAX_TOTAL_BYTES) {
          await write(variantPath(key, width, 'avif'), avif, 'image/avif'); stored++; bytesStored += avif.length;
        } else skipped++;
      }
    } catch { failed++; }
  }
  return { stored, bytesStored, skipped, failed, photo };
}
export async function storeVariants(admin, bytes, key, sourceType, existing = new Set()) {
  const { data: config, error: configError } = await admin.storage.getBucket(VARIANT_BUCKET);
  if (configError || config?.public !== false) throw new Error('Variant bucket is not private');
  const bucket = admin.storage.from(VARIANT_BUCKET);
  return generateVariants(bytes, key, sourceType, async (path, data, type) => {
    const { error } = await bucket.upload(path, data, { contentType: type, cacheControl: String(STORAGE_TTL), upsert: false });
    if (error) throw new Error('Variant upload failed');
  }, existing);
}

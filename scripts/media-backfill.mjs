// Run locally with: node --env-file=.env.local scripts/media-backfill.mjs [--apply]
// Dry run is the default. No article writes, deletes, or original replacements.
import { createClient } from '@supabase/supabase-js';
import { VARIANT_BUCKET, MEDIA_KEY, storeVariants } from '../src/lib/media/variants.mjs';
const args = process.argv.slice(2);
if (args.some(a => !['--apply', '--all'].includes(a))) throw new Error('Supported options: --apply --all');
const apply = args.includes('--apply');
const limit = args.includes('--all') ? Infinity : 100;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !secret || !publishable || !/^sb_secret_/.test(secret) || process.env.APP_MODE === 'preview') throw new Error('A connected Supabase environment and server secret are required. Do not use preview mode.');
const options = { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } };
const admin = createClient(url, secret, options);
const anon = createClient(url, publishable, options);
const { data: original, error: originalError } = await admin.storage.getBucket('article-covers');
if (originalError || original?.public !== false) throw new Error('Original bucket is not verified private. Stopping.');
if (apply) {
  const { data: bucket, error } = await admin.storage.getBucket(VARIANT_BUCKET);
  if (error || bucket?.public !== false) throw new Error('Apply the private media variants migration first. Stopping.');
}
const keys = new Set();
function collect(node, depth=0) {
  if (!node || typeof node !== 'object' || depth > 32) return;
  if (node.type === 'image' && typeof node.attrs?.src === 'string') {
    const prefix='/api/article-media/';
    const key = node.attrs.src.startsWith(prefix) ? node.attrs.src.slice(prefix.length) : '';
    if (MEDIA_KEY.test(key)) keys.add(key);
  }
  if (Array.isArray(node.content)) for (const child of node.content) collect(child, depth+1);
}
let count=0;
for (let offset=0; offset<limit; offset+=100) {
  const { data, error } = await anon.from('articles').select('id,cover_image,content').eq('status','published').order('id').range(offset,offset+Math.min(100,limit-offset)-1);
  if (error) throw new Error('Unable to enumerate published articles. No article data changed.');
  for (const row of data ?? []) {
    count++;
    if (typeof row.cover_image === 'string' && MEDIA_KEY.test(row.cover_image)) keys.add(row.cover_image);
    collect(row.content);
  }
  if (!data || data.length < 100) break;
}
console.log(`${apply?'APPLY':'DRY RUN'}: ${count} published article(s), ${keys.size} distinct referenced image(s). ${limit===100?'First 100 articles; use --all for full backfill.':''}`);
if (!apply) console.log(`Conservative maximum new derivative budget: ${keys.size * 4} MiB; actual storage may be much smaller.`);
let completed=0, stored=0, bytes=0, skipped=0, failed=0;
for (const key of keys) {
  const check = await anon.rpc(apply ? 'mq_media_published' : 'cb_media_visible',{p_path:key});
  if (check.error) { failed++; console.warn('Publication visibility check unavailable; skipped safely.'); continue; }
  if (check.data !== true) { skipped++; continue; }
  if (!apply) { completed++; continue; }
  try {
    const prefix = `v1/${key}`;
    const { data: existing, error: listError } = await admin.storage.from(VARIANT_BUCKET).list(prefix,{limit:100});
    if (listError) throw new Error('Cannot check existing variants');
    const known = new Set((existing??[]).map(x=>`${prefix}/${x.name}`));
    const {data:blob,error} = await admin.storage.from('article-covers').download(key);
    if (error || !blob) throw new Error('Original unavailable');
    const type={jpg:'image/jpeg',png:'image/png',webp:'image/webp',avif:'image/avif'}[key.split('.').pop()];
    const r=await storeVariants(admin,Buffer.from(await blob.arrayBuffer()),key,type,known);
    stored+=r.stored;bytes+=r.bytesStored;failed+=r.failed;completed++;
    console.log(`Processed ${completed}/${keys.size}; new variants: ${r.stored}; skipped: ${r.skipped}; failed: ${r.failed}`);
  } catch { failed++; console.warn('One media item could not be processed; original remains available.'); }
}
console.log(JSON.stringify({apply,articles:count,images:keys.size,eligibleOrProcessed:completed,stored,bytes,skipped,failed}));
if (failed) process.exitCode=1;

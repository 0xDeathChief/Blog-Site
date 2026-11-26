# MadQuill media pipeline V2

## Scope and design

This upgrade keeps the existing stored master, canonical `/api/article-media/<key>` paths, publishing workflow and `article-covers` bucket private. No article rows, originals, accounts, credentials, styles, themes or dependencies are modified. The separate `madquill-media-variants` bucket is private and is blocked from direct anonymous/authenticated storage operations by a restrictive RLS policy. Only the trusted server creates derivatives. The database helper checks published status under the calling user's RLS policies; the application uses an anonymous public client for this check.

Covers use responsive `srcset` widths (320/640/1200/1920), high priority for the featured/reading cover and lazy loading below the fold. JPEG sources use photographic WebP compression with AVIF where smaller; PNG, WebP and AVIF uploads are handled conservatively as lossless WebP derivatives. Classification is intentionally format-based, not semantic AI classification. Full inline technical images retain their existing original route and readability. Existing images can be backfilled without replacing or deleting masters. Missing derivatives fall back to the previous authorized delivery, including on installations that have not yet applied the migration. Each variant is limited to 2 MiB and generation has a 4 MiB new-output budget per run/image; derivatives can add to storage usage. Existing upload constraints remain. The AVIF/WebP quality and bytes vary by source; not every format/width is guaranteed to be produced.

## Rollout (development first)

1. Apply the source update and ensure `npm run lint` and `npm run build` succeed. The installer does not access Supabase, change environment files or run migrations. It supports the audited pre-/post-Performance & SEO patch source, refusing unknown changed files.
2. Review `supabase/migrations/20261126150000_private_media_variants.sql`. In the intended Supabase project's SQL Editor, apply that migration once (or use the team's versioned migration workflow). It creates one private bucket, a restrictive storage policy and a published-only helper. Do not make either bucket public or reapply unrelated old migrations. Take a database backup beforehand. If the database is managed through CLI migration history, record the migration using the team's migration workflow rather than executing it twice.
3. Confirm both buckets show **Private** in Storage. A read-only preflight SQL query is shown below.
4. From the project root, run the backfill dry run:

```powershell
node --env-file=.env.local scripts/media-backfill.mjs
```

The dry run inspects published article media references without writing. It defaults to the first 100 published articles. `--all` includes the rest. Check storage allowance before continuing. To create the optimized objects:

```powershell
node --env-file=.env.local scripts/media-backfill.mjs --apply
```

Add `--all` if appropriate. Only published references are processed; previously existing drafts are not backfilled. New uploads create variants when the mode below is enabled. Rerun backfill after an older draft is published if needed. There are no original replacements, no article writes, no secret values logged. Variant failures are reported and the legacy route remains usable. Existing derivatives are skipped; an AVIF derivative that was not generated alongside its WebP is optional. Do not share `.env.local` or terminal output containing secrets.

5. Choose a local delivery mode. First validate `proxy`, which serves precomputed variants via the same authorization-checked app endpoint and requires a visibility recheck for browser reuse:

```powershell
$env:MADQUILL_MEDIA_MODE = 'proxy'
npm run dev
```

Then stop the server and test optional direct CDN delivery:

```powershell
$env:MADQUILL_MEDIA_MODE = 'cdn'
npm run dev
```

In `cdn` mode, only anonymous-public, published derivative requests with a responsive width receive an HTTP 307 redirect to a signed Storage URL (60-second token, 60-second configured object cache lifetime, redirect no-store). The existing SEO URL `?preview=1` stays a same-origin 200 response; draft/original private requests never receive signed redirects. Short-lived tokens can be reused briefly across readers, after a fresh publication check. Signed URLs/cached bytes cannot be instantly revoked; CDN/browser caches and previously downloaded copies can outlive permission changes. If immediate server-side revocation is required, use `proxy` mode, not `cdn`. Permanent public storage was deliberately deferred until a tested publication/revocation lifecycle can be designed. **Never publish the original or variant bucket.**

The default is `legacy` when unset or invalid. To disable the new storage path without reverting code:

```powershell
$env:MADQUILL_MEDIA_MODE = 'legacy'
```

Restart the app after changing modes. `proxy` and `cdn` require the migration and Supabase config already used by MadQuill. New uploads have best-effort variant generation; if variants fail, the master remains valid. New variants are generated using the Next.js `after()` lifecycle after the successful original-upload response; generation is best-effort and remains subject to the hosting function duration. A failed or interrupted derivative task leaves the master usable. No separate paid service is introduced; Supabase storage and bandwidth quotas still apply.

## Verification

```sql
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('article-covers', 'madquill-media-variants');

select to_regprocedure('public.mq_media_published(text)') as published_check;
```

- Test signed out and signed in: home, discovery, categories, trending, article and protected editor.
- Test mobile and desktop Network tab. On an existing published cover, inspect `/api/article-media/...?...&w=...`. Proxy mode should report `X-MadQuill-Media-Cache: VARIANT-MISS/HIT/COALESCED` when a derivative exists. CDN mode should show a `307` with `CDN-REDIRECT`, followed by a successful Storage response. Do not share full signed URLs. A `MISS/HIT` without `VARIANT` indicates the fallback path. The stable `?preview=1` URL remains a 200 image response. Test direct private bucket access fails for anonymous and authenticated users. Test an unpublished draft's preview endpoint returns 404 and never redirects, while authorized editor access to the original still works. Use a disposable test article for unpublish/re-publish; previously issued tokens/cache may persist briefly in CDN mode.
- Compare cold and warm browser network timings with production build (`npm run build`, `npm run start`), including final image response time after redirects, not only API timing. Test real device and geography. Image-size budgets and Core Web Vitals are targets, not guarantees. Signed URLs and private CDN caching may not outperform proxy mode in every environment; choose measured behavior.
- Verify `/robots.txt`, `/sitemap.xml` (published cover image URLs), article canonical and social metadata. Existing SEO improvements remain included.
- Verify light/dark mode and all visual elements; no CSS is modified. Logo WebP is pixel-identical to the PNG. Pointer and DOM-mutation event work is coalesced per frame; digital rain appearance remains unchanged.

## Production

Only after checks pass, commit changed source, script, documentation and migration. In Vercel set `MADQUILL_MEDIA_MODE=proxy` or `cdn` for Production and redeploy. Ensure the production Supabase project has the migration and backfill, and `NEXT_PUBLIC_SITE_URL` is the real site origin. No new secret or public credential is needed. Never commit `.env.local`. Monitor actual storage/bandwidth usage and choose `proxy` if revocation requirements or measured performance favor it. Verify SEO using Search Console and PageSpeed Insights.

## Rollback

Set `MADQUILL_MEDIA_MODE=legacy` and restart/redeploy first. The canonical URLs and original private objects still work. Source rollback uses the installer's external backup/manifest or a Git revert. Private derivative objects can remain unused; they cost storage. Clean them only after disabling the pipeline and verifying that originals are intact. Do not delete the original bucket or existing article rows. This migration does not address unrelated `PGRST205` engagement-view warnings; investigate separately.

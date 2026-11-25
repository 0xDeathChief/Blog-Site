# CipherBrief V2.2: discovery and community

Apply `20261125223000_discovery_community.sql` once to the existing database (after Community V2 and Workspace V3). The patch does not reset users, articles or media.

## Local development
The PowerShell patch generates a separate `CB_INTERACTION_SECRET` in `.env.local` if absent. Never commit or share it. Guest profile creation without CAPTCHA works only on localhost in development. The guest cookie is signed, HttpOnly, expires after 30 days, and is not a Supabase account. Guest comments are pending until an owner moderates them at `/admin/comments`. Keep Supabase anonymous sign-ins disabled.

## Production
Configure `CB_INTERACTION_SECRET` independently on the host, `NEXT_PUBLIC_SITE_URL` with the production HTTPS origin, and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` from a Cloudflare Turnstile widget restricted to that hostname. Without these CAPTCHA credentials guest participation fails closed in production. The server verifies token, action and hostname. Normal registered users are unaffected. Add Cloudflare challenge origins to a future CSP and the static theme boot script hash to `script-src`. Do not expose the private secret key.

Views are approximate browser-day counts over 30 days, not unique people; cookies can be cleared and global rate limits can undercount. Ranking score = 30-day views + 4 x approved comments in 30 days + 2 x likes in 30 days. Manual editor picks override the hero, not Trending. Old view records are pruned opportunistically; arrange scheduled cleanup before launch.

Images: 0–3 total including cover; original max 5 MiB, output max 2 MiB, one frame, 8-bit, max 16 megapixels. Server uses the `sharp` version included by Next's optional dependencies. Decodes, normalizes orientation/colors, strips metadata and re-encodes WebP losslessly without resizing. Some photos become larger; oversized output is rejected rather than reducing quality. Existing images remain; edit an old article with >3 images only after reducing its count. Unreferenced upload cleanup still requires a safe scheduled storage job.

Test actual upload, guest comment moderation, anonymous media access, published/unpublished articles, admin permissions, mobile and light/dark modes before hosting. Do not deploy until the production smoke tests pass.

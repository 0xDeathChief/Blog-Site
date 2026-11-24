# Security Architecture

CipherBrief uses layered controls: Supabase Auth identifies users, server code checks permissions, and PostgreSQL Row Level Security (RLS) enforces access at the data layer. UI visibility is not an authorization control.

## Authentication and sessions

- Sign-in and recovery use Supabase Auth. Accounts are owner-invited; public self-registration is disabled by the application.
- Server-rendered pages and API handlers use the Supabase SSR client and verify the current user with `auth.getUser()`. The application does not treat an unverified browser-supplied user ID as identity.
- The server loads the active role from `profiles`. Deactivated or missing profiles are not accepted as active principals.
- Session cookies are managed by `@supabase/ssr` and Next.js. Deploy behind HTTPS and configure Supabase Auth redirect URLs and cookie-related hosting settings for the production domain.

## Authorization and database access

- The application checks roles on the server for protected pages and API operations: `owner`, `editor`, `contributor`, and `reader`.
- The migrations enable RLS for user and community data. Policies restrict unpublished articles and editorial history to their authors and authorized editors/owners, keep AI conversations private to their owner, and restrict engagement records to the relevant reader.
- Article saves and workflow transitions use database functions that check the current account and role. Contributors cannot edit another author's article or publish directly; publishing and role assignment require an owner.
- Authenticated users receive column-level profile update privileges for editable profile fields, not `role` or `status`. Role changes go through an owner-checked function. The public Supabase publishable key is not a substitute for these policies.
- Storage policies scope cover uploads to allowed roles and user-owned folders. Validate the RLS policies and grants in the target Supabase project after applying migrations.

## Request protections and validation

- Mutating authenticated API handlers require an `Origin` matching the request origin; missing or mismatched origins are rejected. The AI and translation handlers apply the same check directly. This is the application's CSRF control for these routes; do not add cross-origin mutation routes without an explicit CSRF design.
- JSON request bodies are size-limited and parsed server-side. Zod schemas validate article, profile, workflow, AI, and administrative inputs. Database constraints and guarded functions provide additional validation for persisted data.
- Article documents are recursively allowlisted and bounded by node count, nesting depth, and text size. Link and image URLs are protocol-checked; images require HTTPS, and links receive `noopener noreferrer nofollow`.
- React Markdown is rendered without enabling raw HTML. Article content is stored as validated Tiptap JSON and rendered through the editor, rather than injected with `dangerouslySetInnerHTML`.
- API responses use generic error messages for expected failures. Operational details, when logged, remain server-side; do not return stack traces, SQL errors, prompts containing private data, or secret values to clients.

## Cover-image uploads

- Uploads are limited to 5 MiB and JPEG, PNG, WebP, or AVIF. The server checks both the declared MIME type and the file signature, creates a random object name under the user's folder, and verifies contributor access to the target article.
- Supabase Storage also has MIME/size limits and RLS policies. The `article-covers` bucket is intentionally public so published cover images can be displayed without authentication; never store private files in it.
- Signature checks do not replace full image decoding, malware scanning, or re-encoding. Add those controls if the deployment's threat model requires stronger protection against malformed image files.

## Rate limiting and AI

- AI requests are limited to 20 per authenticated user or 10 per anonymous client per five-minute window. Translation limits are 12 and 6 respectively. Owner-protected API calls using the shared owner guard are limited to 30 per owner per five minutes.
- Rate-limit counters are maintained by a database function. AI operations fail closed when rate limiting is not configured or cannot be enforced.
- IP-based limits use `x-real-ip` or `x-forwarded-for`; configure the hosting proxy to overwrite or sanitize these headers. Do not trust client-supplied forwarding headers at an untrusted ingress.
- Ollama requests and model configuration are server-side. The assistant applies bounded inputs and defensive-use checks, but prompt filters and local models are not a security boundary. Do not submit passwords, credentials, private keys, or other sensitive material to AI features.

## Secrets and configuration

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are public configuration values. Data confidentiality and integrity depend on server authorization and correctly applied RLS policies.
- `SUPABASE_SERVICE_ROLE_KEY` is privileged. It is read only in server-only modules for administrative operations and must never be given a `NEXT_PUBLIC_` prefix, returned to the browser, or placed in client components.
- Keep Ollama URLs, private provider credentials, database credentials, and all other secrets in the deployment's protected environment-variable store. `.env*` files are ignored by Git except for the placeholder `.env.example`; never put real credentials in that example or commit them.
- Restrict access to production environment settings, rotate exposed credentials immediately, and use separate credentials/projects for development and production.

## Audit and operational checks

- Owner-only audit records cover account administration and article workflow/review activity. They are intended for accountability, not as a substitute for infrastructure or database logs.
- Apply migrations in timestamp order and test RLS using anonymous, reader, contributor, editor, and owner accounts before production. In particular, verify unpublished-article isolation, role-update restrictions, storage policies, account deactivation, and workflow transitions.
- Keep the Next.js, Supabase, and dependency versions patched. Review deployment logs for secret leakage and unexpected authorization failures.

## Scope and limitations

This document describes controls implemented in the repository; it is not a claim of a completed penetration test or production security certification. The migrations have not been executed against a live Supabase project in this development environment. Hosting configuration, Supabase Auth settings, database grants/RLS, proxy headers, backups, monitoring, and Ollama network exposure must be verified for each deployment.

Report suspected vulnerabilities privately to the project owner. Include affected routes or data and concise reproduction details, but do not include real credentials or other people's private data.

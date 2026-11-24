# Architecture

CipherBrief uses the Next.js App Router, server-rendered React, and Supabase. Route components handle page composition; reusable interface components and server-side business logic live in separate directories.

## Source layout

```text
src/
  app/                 Pages, layouts, metadata routes, and API route handlers
  components/
    admin/             Owner dashboard UI
    ai/                Learning assistant UI
    articles/          Article editing, reading, and engagement UI
    auth/              Sign-in and recovery forms
    layout/            Site-wide header and theme controls
    portal/            Shared account-workspace UI
    profile/           Profile UI
    public/            Public page, directory, discovery, and article-list UI
  lib/
    ai/                Ollama, assistant, translation, and rate-limit logic
    articles/          Article validation, access, and public-data queries
    auth/              Server authorization and API guards
    seo/               Site URL and metadata helpers
    supabase/          Browser, session, public, admin, and config clients
supabase/
  migrations/          Ordered PostgreSQL schema and policy changes
public/                Static assets served as-is
docs/                  Project and operations documentation
```

Keep UI in `src/components` and business logic in `src/lib` or API route handlers. Server Components are the default; add a Client Component only for browser state, event handling, or browser APIs. Add folders such as `hooks`, `validation`, or `services` when there is real code to organize, rather than creating empty scaffolding.

The existing route paths are kept directly under `src/app` to preserve URLs. Next.js route groups such as `(public)` are optional; use them only when a shared layout or access boundary justifies moving routes.

## Request and data flow

1. A page or API handler receives the request.
2. User-specific reads and writes use the Supabase SSR client and verify the active account and role on the server.
3. Public content uses the anonymous Supabase client, so database RLS—not a service-role key—defines the public data boundary.
4. PostgreSQL constraints, guarded functions, and RLS enforce the final write and read rules.

The service-role client is isolated to server-only administrative operations. Never import it into a page component or browser bundle.

## Rendering and caching

- Public article and discovery data is cached for five minutes; category/tag/author directories for ten minutes; site metadata for one hour.
- Sitemap output is refreshed hourly. Relevant article, profile, catalog, featured-content, and site-setting mutations invalidate their associated cache tags.
- Account-sensitive pages and article comments remain request-specific; they are not stored in the shared public-content cache.
- Article listing cover images use the Next.js image optimizer. Grid images are lazy-loaded by default; featured images load eagerly.

See [DATABASE.md](./DATABASE.md), [RBAC.md](./RBAC.md), and [API.md](./API.md) for the corresponding boundaries.

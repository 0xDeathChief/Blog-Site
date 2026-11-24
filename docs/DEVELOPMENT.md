# Development

## Phased workflow

Work in one phase at a time. Review its design and dependencies before implementation; do not generate or replace the whole application in a single pass. Keep completed decisions and validation evidence in the relevant documentation.

| Phase | Scope | Exit gate |
|---|---|---|
| 1. Architecture and planning | Architecture, schema/ERD, RBAC, structure, UI tokens, key decisions | Review the documents and resolve open design decisions before starting new features |
| 2. Project setup | Next.js, dependencies, Tailwind/DaisyUI, Supabase config, environment, initial layout | App builds and configuration errors are clear |
| 3. Authentication and RBAC | Auth, profiles, server authorization, RLS | Verify each role and denied operation against a development database |
| 4. Blog engine | Editor, drafts, review workflow, publishing, categories/tags | Verify workflow states/history and unpublished-content isolation |
| 5. Dashboards | Contributor, editor, owner, reader experiences | Verify server permissions and empty/error/loading states per role |
| 6. AI integration | Ollama, teaching modes, article context, Bangla, translation | Verify model connectivity, language behavior, failure handling, and rate limits |
| 7. Community features | Comments, engagement, profiles, reading history | Verify ownership rules, duplicate prevention, and moderation behavior |
| 8. Optimization and security | SEO, performance, security, responsive UI, testing, error handling | Run the automated checks and all required integration tests; resolve failures |
| 9. Final documentation | Install, environment, database, AI, deployment, troubleshooting, API | Ensure docs match verified behavior and operational requirements |

### Current project position

This repository already contains implementation work across Phases 2–8. Continue from the existing code instead of restarting. Planning references are in [ARCHITECTURE.md](./ARCHITECTURE.md), [DATABASE.md](./DATABASE.md), and [RBAC.md](./RBAC.md); design tokens are recorded in [ARCHITECTURE.md](./ARCHITECTURE.md).

Treat authentication/RBAC, workflow, RLS, and AI as **implemented but not integration-verified** until the scenarios in [TESTING.md](./TESTING.md) have actually run against a dedicated development Supabase project and Ollama instance. Public self-registration is intentionally disabled; new accounts are owner-invited. Phase 9 documentation is underway; add deployment and troubleshooting guidance before production handoff.

## Requirements

- Node.js and npm compatible with the versions in `package.json` and `package-lock.json`.
- A Supabase project for database-backed pages, auth, storage, and rate limits.
- Ollama only if working on the local AI features.

## Start the application

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Set `NEXT_PUBLIC_SITE_URL` to the canonical production origin before deployment. `NEXT_PUBLIC_SUPABASE_URL` must be available at build time to allow Next.js to optimize images from the project's public cover-image bucket.

## Verify changes

```powershell
npm run lint
npm run build
```

Use JavaScript/JSX; do not add TypeScript, Prisma, MongoDB, or WordPress. Keep page composition in App Router files, reusable interface code in `src/components`, and business/data logic in `src/lib`. Use Server Components by default and keep client-side state in the smallest necessary Client Component.

## Database and environment

Apply the migrations in [DATABASE.md](./DATABASE.md) to a development Supabase project before testing database-backed features. Promote the first owner only through the documented bootstrap step in [README.md](../README.md). Never commit `.env.local` or copy real secrets into `.env.example`.

The migrations have not been verified against a live Supabase project in this workspace; test RLS, storage policies, Auth callbacks, and database functions before release.

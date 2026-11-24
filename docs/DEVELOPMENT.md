# Development

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

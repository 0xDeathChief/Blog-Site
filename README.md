# CipherBrief

A cybersecurity publication and learning-community project, built with the Next.js App Router.

## Stack

- JavaScript and JSX; server components by default, client components for interactive navigation and search.
- Tailwind CSS 4, DaisyUI, and Lucide React.
- Supabase PostgreSQL, Authentication, and Storage through `@supabase/ssr`.
- Zod for validating configuration and future user input.
- Ollama through a server-only, model-configurable helper.
- React Markdown and Tiptap are installed for the upcoming article-reading and editing features.

## Run locally

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open http://localhost:3000. The public homepage works without external credentials. Supabase or Ollama calls require the corresponding values in `.env.local`.

## Supabase and RBAC setup

1. Create a Supabase project and configure its Auth email/invite provider.
2. Apply [`20261124170000_roles_and_editorial_workflow.sql`](./supabase/migrations/20261124170000_roles_and_editorial_workflow.sql) using the Supabase SQL Editor or your Supabase migration workflow.
3. Copy the project URL, publishable key, and service-role key into `.env.local`. The service-role key is server-only and must never use a `NEXT_PUBLIC_` prefix.
4. Create the first account in Supabase Auth. In the SQL Editor, promote that account exactly once using its Auth user UUID:

   ```sql
   update public.profiles
   set role = 'owner'
   where id = 'YOUR_AUTH_USER_UUID'::uuid
     and role = 'reader'
     and status = 'active';
   ```

   Confirm that exactly one row changed. After bootstrap, use the owner-only account API to invite and manage users.

The migration creates the four roles, article workflow, feedback/revision history, moderation logs, settings, and cover-image bucket. It enables RLS, restricts profile role changes to an owner-checked RPC, and limits article state transitions to guarded database functions. The API also verifies the Supabase session on the server, checks request origin for mutations, and applies a database-backed rate limit.

Do not treat UI visibility as authorization. Protected reads/writes must continue to use server authorization and the migration's RLS/RPC policies. Account administration is available at `GET`/`POST /api/admin/users` and `PATCH`/`DELETE /api/admin/users/:userId`.

## Local AI setup

1. Install Ollama and pull a model supported by your machine.
2. Set `OLLAMA_BASE_URL` and `OLLAMA_MODEL` in `.env.local`.
3. The Ollama helper is server-only. It is not exposed as a user-facing endpoint.

## Current implementation boundary

The public homepage and local article search are implemented. RBAC policies and the owner-only account API are foundations; user-facing sign-in, dashboards, article editor/review screens, uploads, comments, bookmarks, likes, and AI/translation endpoints still need UI and integration tests. Apply the migration to a Supabase project before using the protected API.

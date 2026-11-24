# CipherBrief

A cybersecurity publication and learning-community project, built with the Next.js App Router.

## Stack

- JavaScript and JSX; server components by default, client components for interactive navigation and search.
- Tailwind CSS 4, DaisyUI, and Lucide React.
- Supabase PostgreSQL, Authentication, and Storage through `@supabase/ssr`.
- Zod for validating configuration and future user input.
- Ollama through a server-only, model-configurable helper.
- Tiptap provides rich article editing, syntax-highlighted code, tables, images, and Markdown import/export.
- Zod validates article metadata and the server sanitizes the Tiptap document before saving.

## Run locally

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open http://localhost:3000. The public homepage works without external credentials. Supabase or Ollama calls require the corresponding values in `.env.local`.

## Supabase and RBAC setup

1. Create a Supabase project and configure its Auth email/invite provider.
2. Apply both migrations in timestamp order using the Supabase SQL Editor or your Supabase migration workflow:
   - [`20261124170000_roles_and_editorial_workflow.sql`](./supabase/migrations/20261124170000_roles_and_editorial_workflow.sql)
   - [`20261124233000_article_management.sql`](./supabase/migrations/20261124233000_article_management.sql)
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

The migrations create the four roles, article workflow, feedback/revision history, moderation logs, settings, seeded starter categories/tags, and the cover-image bucket. They enable RLS, restrict profile role changes to an owner-checked RPC, and limit article state transitions and snapshots to guarded database functions. The API verifies sessions and roles on the server, checks request origin for mutations, validates cover-image content, and sanitizes article documents before saving.

## Article workflow

1. Sign in at `/sign-in`. Accounts are owner-invited; public self-registration is not enabled.
2. Contributors and owners can draft at `/dashboard/articles`. The editor supports headings, formatting, lists, links, HTTPS images, tables, Markdown import/export, and syntax-highlighted code blocks.
3. Save a draft, then submit it for review. Editors can start review, request revisions, reject, or approve. Only an owner can publish or unpublish.
4. Published articles appear on the home page and at `/articles/:slug`. Reading time is calculated from article text when the server saves it.

Article revisions keep the previous content and metadata, including category, difficulty, cover path, and tagged values. Workflow events record the actor/reviewer, timestamp, and status before and after each transition. Editorial feedback is shown with its reviewer and date. Article edits and transitions are restricted by both server authorization and database functions/RLS; changing or hiding a button does not grant permission.

Account administration is available at `GET`/`POST /api/admin/users` and `PATCH`/`DELETE /api/admin/users/:userId`.

## Local AI setup

1. Install Ollama and pull a model supported by your machine.
2. Set `OLLAMA_BASE_URL` and `OLLAMA_MODEL` in `.env.local`.
3. The Ollama helper is server-only. It is not exposed as a user-facing endpoint.

## Current implementation boundary

The article workspace, editorial workflow, cover upload validation, sign-in form, and published-article reader are implemented. Reader comments, bookmarks, likes, category/tag management screens, password/invitation callback flows, and AI/translation endpoints remain future work. The migrations have not been applied to a live Supabase project here; SQL execution, RLS behavior, storage policies, and Auth integration must be validated in a development project before production use.

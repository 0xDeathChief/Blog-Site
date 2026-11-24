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

## Supabase setup

1. Create a Supabase project.
2. Copy the project URL and publishable key into `.env.local`.
3. Keep privileged keys out of browser code. Server-side role checks and database Row Level Security policies must both be in place before protected operations are added.

## Local AI setup

1. Install Ollama and pull a model supported by your machine.
2. Set `OLLAMA_BASE_URL` and `OLLAMA_MODEL` in `.env.local`.
3. The Ollama helper is server-only. Add rate limiting and authorization in a Route Handler before exposing it to users.

## Current implementation boundary

The homepage and local article search are implemented. The Supabase clients and Ollama provider are foundations, not a finished sign-in, submission, review, upload, or chat feature. Those features need database migrations, RLS policies, server-side authorization, rate limits, and tests before they should be exposed in the UI.

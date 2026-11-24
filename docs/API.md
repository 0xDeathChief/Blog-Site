# API reference

API endpoints are Next.js Route Handlers under `src/app/api`. Mutating handlers validate input on the server, check request origin/session/role as applicable, and return a non-success status when an operation fails. Database RLS and guarded functions remain the final access boundary.

| Endpoint | Methods | Purpose |
|---|---|---|
| `/api/articles` | `GET`, `POST` | List accessible workspace articles or create a draft |
| `/api/articles/:articleId` | `GET`, `PATCH`, `POST`, `DELETE` | Read article history, save, transition workflow, or owner-delete |
| `/api/article-covers` | `POST` | Validate and upload an authorized article cover |
| `/api/admin/users` | `GET`, `POST` | List accounts or invite an account; owner-only |
| `/api/admin/users/:userId` | `PATCH`, `DELETE` | Change account role/status or delete; owner-only |
| `/api/admin/catalog/:kind` | `GET`, `POST`, `PATCH`, `DELETE` | Manage categories and tags; owner-only |
| `/api/admin/featured` | `POST` | Set featured article; owner-only |
| `/api/admin/settings/:kind` | `GET`, `PUT` | Read or update AI/site settings; owner-only |
| `/api/profile` | `PATCH` | Update the signed-in user's profile |
| `/api/reader/activity` | `GET`, `POST`, `DELETE` | Manage bookmarks, likes, comments, and reading history |
| `/api/reader/conversations` | `GET`, `POST` | List or save the current reader's AI conversations |
| `/api/reader/conversations/:conversationId` | `DELETE` | Delete the current reader's conversation |
| `/api/ai/assistant` | `POST` | Generate a rate-limited Ollama learning response |
| `/api/ai/translate` | `POST` | Generate or retrieve a separate article/response translation |

Request and response shapes are validated in the corresponding route handlers and schemas in `src/lib`. Do not call privileged database functions directly from browser code or expose the service-role key.

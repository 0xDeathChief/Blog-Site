# Roles and permissions

The server checks the signed-in user's active profile and role. PostgreSQL RLS and guarded database functions independently enforce data access and workflow rules.

| Capability | Owner | Editor | Contributor | Reader |
|---|---:|---:|---:|---:|
| Public articles, categories, and tags | Yes | Yes | Yes | Yes |
| Read and manage own profile | Yes | Yes | Yes | Yes |
| Create and edit own drafts | Yes | No | Yes | No |
| Submit own article for review | Yes | No | Yes | No |
| Review, comment on, or request revisions | Yes | Yes | No | No |
| Approve an article for owner review | Yes | Yes | No | No |
| Publish or unpublish articles | Yes | No | No | No |
| Manage accounts and assign roles | Yes | No | No | No |
| Manage site settings, catalogs, and featured content | Yes | No | No | No |
| Bookmark, like, comment, and use the learning assistant | Yes | Yes | Yes | Yes |

Editors can review submissions and approve them for owner review, but cannot publish or change roles. Contributors can revise their own articles and see editorial feedback, but cannot modify other authors' content. Readers use account features but cannot access editorial workspaces.

Only an owner can grant or remove the owner role. Role changes are performed through owner-checked server operations; clients cannot update their own role or status. See the role policies and transition functions in the ordered SQL migrations in [DATABASE.md](./DATABASE.md).

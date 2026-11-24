# Testing

Run integration checks only against a dedicated development Supabase project with disposable test accounts and content. Do not run workflow, account deletion, or invalid-model tests against production.

## Local checks

```powershell
npm run lint
npm run build
```

The project does not currently include an automated browser or database test runner. A successful lint/build checks code quality and compilation; it does not prove Auth, RLS, workflow, or Ollama behavior.

## Authentication

Use the application sign-in and invite flows with a disposable account.

- **Registration:** public self-registration is intentionally disabled. Confirm `/register` explains the invite-only process and does not create an account. Invite a test account as the owner instead.
- **Login:** sign in with a valid invited account and confirm an invalid password is rejected without revealing account details.
- **Logout:** sign out and verify protected pages redirect/deny access and the old session cannot call protected APIs.
- **Session persistence:** refresh the page and open a second tab while signed in; confirm the session remains. Sign out, then verify both tabs lose access after refresh.
- **Deactivated account:** deactivate a disposable account and confirm its session is rejected on subsequent server requests.

## RBAC

Create one active test account for each role: owner, editor, contributor, and reader. Test authorization through the UI and the corresponding API, not by hiding buttons alone.

- **Owner:** invite/update test accounts, manage catalogs/settings/featured content, review submissions, and publish/unpublish an approved article.
- **Editor:** start a review, add feedback, request revision, reject, and approve for owner review. Confirm role/account/site-setting changes and publishing are denied.
- **Contributor:** create/save/submit a draft, edit their own eligible article, and read feedback. Confirm another contributor's article cannot be read or changed and publishing is denied.
- **Reader:** browse published content and manage their own bookmark, like, comment, reading history, and AI conversation. Confirm contributor/editor/admin workspaces and mutations are denied.
- For each denied action, verify the server returns a denial and the database state remains unchanged.

## Article workflow

Use a disposable contributor article and verify both its status and recorded history after every operation:

1. Create a draft and save edits.
2. Submit it; verify it enters `submitted`.
3. Have an editor start review; verify `in_review`.
4. Request a revision; verify `revision_requested`, reviewer, feedback, and prior/new statuses are recorded.
5. Revise and resubmit; repeat review and approve for owner review.
6. Publish as owner; verify it becomes publicly readable and appears in discovery/sitemap after cache revalidation.
7. Attempt to publish as a contributor and editor; verify denial and no status change.
8. Unpublish as owner and verify the article is no longer publicly readable or listed.

The database uses `in_review` as the stored status for the review stage. Workflow transitions must go through the guarded transition function/API rather than direct client updates.

## Database and RLS

Use anonymous and authenticated test sessions. SQL Editor sessions commonly run with elevated database privileges and are not sufficient to prove RLS behavior.

- Read a published article anonymously; try the same with a draft, submitted, under-review, revision-requested, rejected, and unpublished article. Only the published article should be visible publicly.
- Attempt to read or update another contributor's draft and editorial records. Confirm RLS/API denial.
- Insert rows with nonexistent profile/article/category/tag/conversation IDs; confirm foreign-key rejection.
- Like and bookmark the same article twice as one reader. Confirm duplicates are prevented by the unique constraint; verify the UI/API handles an already-saved item without creating a second row.
- Attempt to change a profile's own role/status and attempt a non-owner role assignment. Confirm database/API denial and unchanged values.
- Attempt editor/contributor publishing through the workflow API and directly through an authenticated database session. Confirm both paths are denied.

## AI and translation

With Ollama running and the test model installed:

- Confirm the configured model appears in `ollama list` and Ollama responds to `ollama run <model> "Reply with OK"`.
- Ask a simple question in English and confirm a non-empty English answer.
- Ask the same question in Bangla mode and Bangla + English technical terms mode; inspect that the response follows the selected language.
- Translate a published article and a selected passage; confirm formatting/code are preserved and original article content is unchanged.
- Test an unavailable Ollama endpoint and a nonexistent model in the isolated test environment. Confirm a clear service error, no provider details/secrets in the response, and no fabricated successful answer.
- Confirm invalid/oversized requests and rate-limit exhaustion are rejected.

## Recording results

Record each scenario as **PASS** only after observing the expected result, **FAIL** if behavior differs, or **BLOCKED** when its required service, role account, or fixture is unavailable. Include the environment (local/staging), test date, and failure details without recording credentials or private user data.

# Local AI setup

CipherBrief calls Ollama from server-side code. The browser does not choose the provider URL or model, and no provider secret is sent to the client.

## Install and configure

1. Install Ollama for your operating system and start its local service.
2. Download a model appropriate for the machine. For example, in PowerShell:

   ```powershell
   ollama pull qwen2.5:7b
   ```

3. Set the server environment in `.env.local`:

   ```text
   OLLAMA_BASE_URL=http://127.0.0.1:11434
   OLLAMA_MODEL=qwen2.5:7b
   ```

4. Configure Supabase and apply all migrations; rate limiting and conversation persistence use the database.
5. Start the app and open `/learning-assistant`.

The owner can also configure the AI model and enabled state in the admin settings. Keep Ollama bound to a trusted local/private interface; do not expose its unauthenticated API to the public internet.

## Features and limits

The assistant supports beginner through deep-dive teaching modes, English and Bangla responses, article questions, selected-text explanations, summaries, quizzes, notes, and learning roadmaps. Translation is available separately and does not overwrite article content.

Requests are validated, size-bounded, same-origin checked, and rate-limited. Article context is loaded server-side and only the relevant selection is sent for selection-based requests. Local models and prompt filters are not a security boundary; do not submit credentials, private keys, or other sensitive material.

For troubleshooting and further security details, see [SECURITY.md](./SECURITY.md) and [README.md](../README.md).

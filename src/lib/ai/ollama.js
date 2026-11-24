import "server-only";

import { z } from "zod";

const requestSchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
  system: z.string().trim().max(2000).optional(),
});

const configSchema = z.object({
  baseUrl: z.string().url(),
  model: z.string().trim().min(1).max(128),
});

const responseSchema = z.object({
  response: z.string(),
});

export async function generateWithOllama(input) {
  const request = requestSchema.safeParse(input);
  if (!request.success) {
    throw new Error("The Ollama prompt is invalid.");
  }

  const config = configSchema.safeParse({
    baseUrl: process.env.OLLAMA_BASE_URL,
    model: process.env.OLLAMA_MODEL,
  });
  if (!config.success) {
    throw new Error("Set a valid OLLAMA_BASE_URL and OLLAMA_MODEL.");
  }

  const endpoint = new URL("/api/generate", config.data.baseUrl);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.data.model,
      prompt: request.data.prompt,
      system: request.data.system,
      stream: false,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    throw new Error(`Ollama returned HTTP ${response.status}.`);
  }

  const result = responseSchema.safeParse(await response.json());
  if (!result.success) {
    throw new Error("Ollama returned an unexpected response.");
  }

  return result.data.response;
}

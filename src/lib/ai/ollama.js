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
const chatRequestSchema = z.object({
  system: z.string().trim().min(1).max(6000),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(24000),
  }).strict()).min(1).max(16),
}).strict();
const chatResponseSchema = z.object({
  message: z.object({ content: z.string().trim().min(1).max(20000) }),
});

export class OllamaRequestError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "OllamaRequestError";
    this.code = code;
  }
}

function getOllamaConfig() {
  const config = configSchema.safeParse({
    baseUrl: process.env.OLLAMA_BASE_URL,
    model: process.env.OLLAMA_MODEL,
  });
  if (!config.success) {
    throw new OllamaRequestError("configuration", "Set a valid OLLAMA_BASE_URL and OLLAMA_MODEL.");
  }
  const baseUrl = new URL(config.data.baseUrl);
  if (!["http:", "https:"].includes(baseUrl.protocol)) {
    throw new OllamaRequestError("configuration", "OLLAMA_BASE_URL must use HTTP or HTTPS.");
  }
  return { ...config.data, baseUrl };
}

export async function generateWithOllama(input) {
  const request = requestSchema.safeParse(input);
  if (!request.success) {
    throw new Error("The Ollama prompt is invalid.");
  }

  const config = getOllamaConfig();
  const endpoint = new URL("/api/generate", config.baseUrl);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
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

export async function generateChatWithOllama(input) {
  const request = chatRequestSchema.safeParse(input);
  if (!request.success) {
    throw new OllamaRequestError("invalid_request", "The local AI request is invalid.");
  }

  const config = getOllamaConfig();
  let response;
  try {
    response = await fetch(new URL("/api/chat", config.baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: request.data.system },
          ...request.data.messages,
        ],
        stream: false,
        options: { temperature: 0.3, num_ctx: 8192, num_predict: 1200 },
      }),
      signal: AbortSignal.timeout(90_000),
      cache: "no-store",
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new OllamaRequestError("timeout", "The local model took too long to respond.");
    }
    throw new OllamaRequestError("connection", "Unable to connect to the local Ollama service.");
  }

  if (!response.ok) {
    throw new OllamaRequestError("provider", `Ollama returned HTTP ${response.status}.`);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new OllamaRequestError("invalid_response", "Ollama returned invalid JSON.");
  }
  const result = chatResponseSchema.safeParse(payload);
  if (!result.success) {
    throw new OllamaRequestError("invalid_response", "Ollama returned an unexpected response.");
  }
  return result.data.message.content.trim();
}

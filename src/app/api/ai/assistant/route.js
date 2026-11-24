import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { generateChatWithOllama, OllamaRequestError } from "@/lib/ai/ollama";
import {
  assistantRequestSchema,
  buildAssistantSystemPrompt,
  buildAssistantUserMessage,
  chunkArticleText,
  extractArticleText,
  normalizeArticleText,
  selectRelevantArticleText,
} from "@/lib/ai/assistant";
import { readJsonBody } from "@/lib/auth/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const maxDuration = 300;

const selectionTasks = new Set([
  "selection_explain",
  "selection_simplify",
  "selection_translate",
  "selection_code",
]);
const articleContextTasks = new Set(["article_question", "summarize", "quiz", "notes"]);
const unsafeRequestPatterns = [
  /\b(?:write|create|generate|build|provide|make)\b.{0,40}\b(?:exploit code|payloads?|shellcode|reverse shell|malware sample|ransomware sample|keylogger|credential stealer|phishing kit|phishing email)\b/i,
  /\b(?:write|create|generate|build|provide|make)\s+(?:(?:me|a|an)\s+){0,2}(?:malware|ransomware|keylogger|credential stealer|phishing kit)\b/i,
  /\b(?:steal|exfiltrate|dump)\b.{0,50}\b(?:passwords?|credentials?|tokens?|private data)\b/i,
  /\b(?:evade|bypass)\b.{0,50}\b(?:antivirus|edr|detection|authentication|waf)\b/i,
  /\b(?:scan|exploit|attack|hack|enumerate|probe)\b.{0,80}\b(?:\d{1,3}(?:\.\d{1,3}){3}|https?:\/\/|(?:[a-z0-9-]+\.)+[a-z]{2,}\b|production system|public server|third.party)\b/i,
];

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const parsedBody = await readJsonBody(request, { maxBytes: 64 * 1024 });
  if (parsedBody.response) return parsedBody.response;
  const parsedRequest = assistantRequestSchema.safeParse(parsedBody.body);
  if (!parsedRequest.success) {
    return NextResponse.json({ error: "Check the question, context, language, and teaching mode." }, { status: 400 });
  }

  const input = parsedRequest.data;
  if (selectionTasks.has(input.task) && (!input.articleSlug || !input.selection)) {
    return NextResponse.json({ error: "Select text from a published article before using this action." }, { status: 400 });
  }
  if (input.task === "article_question" && !input.articleSlug) {
    return NextResponse.json({ error: "Open a published article to use its context for this action." }, { status: 400 });
  }

  if (unsafeRequestPatterns.some((pattern) => pattern.test(input.question))) {
    return NextResponse.json(
      { error: "I can help explain concepts, identify risks, and improve defenses, but not provide instructions to compromise systems or evade security." },
      { status: 400 },
    );
  }

  let supabase;
  let userId = null;
  try {
    supabase = await createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      return NextResponse.json({ error: "Unable to verify the current session." }, { status: 401 });
    }
    userId = authData.user?.id ?? null;
  } catch (error) {
    console.error("AI assistant requires a configured Supabase server client.", error);
    return NextResponse.json({ error: "The assistant service is not configured yet." }, { status: 503 });
  }

  const rateLimitResponse = await checkRateLimit(request, userId);
  if (rateLimitResponse) return rateLimitResponse;

  let article = null;
  let articleContext = null;
  let longSummaryChunks = null;
  if (input.articleSlug) {
    const { data, error } = await supabase
      .from("articles")
      .select("title, summary, content")
      .eq("slug", input.articleSlug)
      .eq("status", "published")
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: "Unable to load article context." }, { status: 502 });
    }
    if (!data) {
      return NextResponse.json({ error: "Published article not found." }, { status: 404 });
    }
    const articleText = extractArticleText(data.content);
    article = { title: data.title, summary: data.summary };

    if (input.selection) {
      if (!normalizeArticleText(articleText).includes(normalizeArticleText(input.selection))) {
        return NextResponse.json({ error: "The selected text does not match this article." }, { status: 400 });
      }
      articleContext = input.selection;
    } else if (input.task === "summarize") {
      if (articleText.length > 96_000) {
        return NextResponse.json(
          { error: "This article exceeds the assistant's bounded summary limit. Select a shorter section and use the selected-text action." },
          { status: 413 },
        );
      }
      if (articleText.length > 16_000) {
        longSummaryChunks = chunkArticleText(articleText);
        if (!longSummaryChunks) {
          return NextResponse.json(
            { error: "This article is too long to summarize in one request. Select a shorter section and try again." },
            { status: 413 },
          );
        }
      } else {
        articleContext = articleText;
      }
    } else if (articleContextTasks.has(input.task)) {
      articleContext = selectRelevantArticleText(articleText, input.question);
    }
  }

  if (article) article.context = articleContext;
  const messages = input.history.map((message) => ({
    role: message.role,
    content: message.content,
  }));
  messages.push({
    role: "user",
    content: buildAssistantUserMessage({
      question: input.question,
      task: input.task,
      article,
      selection: input.selection ? articleContext : null,
    }),
  });

  try {
    const system = buildAssistantSystemPrompt(input);
    const answer = longSummaryChunks
      ? await summarizeLongArticle({ input, article, chunks: longSummaryChunks, system })
      : await generateChatWithOllama({ system, messages });
    return NextResponse.json({ answer, createdAt: new Date().toISOString() }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof OllamaRequestError) {
      console.error("Ollama assistant request failed.", error.code);
      return NextResponse.json(
        {
          error: error.code === "timeout"
            ? "The local model took too long to respond. Try again or use a shorter question."
            : "The local AI assistant is unavailable. Check that Ollama is running and the configured model is installed.",
        },
        { status: error.code === "timeout" ? 504 : 503 },
      );
    }
    console.error("Unexpected AI assistant failure.", error);
    return NextResponse.json({ error: "Unable to generate an answer right now." }, { status: 500 });
  }
}

async function summarizeLongArticle({ input, article, chunks, system }) {
  const sectionSummaries = [];
  for (const [index, chunk] of chunks.entries()) {
    const sectionMessage = buildAssistantUserMessage({
      question: `Summarize section ${index + 1} of ${chunks.length} in 4 to 6 concise bullets. Preserve its key ideas and defensive takeaways without adding facts.`,
      task: "summarize",
      article: { ...article, context: chunk },
    });
    const summary = await generateChatWithOllama({
      system,
      messages: [{ role: "user", content: sectionMessage }],
    });
    sectionSummaries.push(`Section ${index + 1}:\n${summary.slice(0, 1800)}`);
  }

  const finalMessage = buildAssistantUserMessage({
    question: input.question,
    task: input.task,
    article: { ...article, context: sectionSummaries.join("\n\n") },
  });
  return generateChatWithOllama({
    system,
    messages: [{ role: "user", content: finalMessage }],
  });
}

async function checkRateLimit(request, userId) {
  const address = request.headers.get("x-real-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0].trim()
    ?? "shared";
  const subject = userId
    ? `user:${userId}`
    : `ip:${createHash("sha256").update(address).digest("hex")}`;
  let adminClient;
  try {
    adminClient = createSupabaseAdminClient();
  } catch (error) {
    console.error("AI assistant rate limiting is not configured.", error);
    return NextResponse.json({ error: "The assistant service is not configured yet." }, { status: 503 });
  }

  const { data: withinLimit, error } = await adminClient.rpc("consume_rate_limit", {
    p_bucket_key: `ai:${subject}`,
    p_request_limit: userId ? 20 : 10,
    p_window_seconds: 300,
  });
  if (error) {
    console.error("AI assistant rate limit could not be enforced.", error);
    return NextResponse.json({ error: "The assistant service is temporarily unavailable." }, { status: 503 });
  }
  if (!withinLimit) {
    return NextResponse.json(
      { error: "You've reached the assistant request limit. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": "300", "Cache-Control": "no-store" } },
    );
  }
  return null;
}

function isSameOriginRequest(request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

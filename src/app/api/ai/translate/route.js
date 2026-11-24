import { NextResponse } from "next/server";
import { extractArticleText, normalizeArticleText } from "@/lib/ai/assistant";
import { checkAiRateLimit } from "@/lib/ai/rate-limit";
import { OllamaRequestError } from "@/lib/ai/ollama";
import {
  TranslationFormatError,
  TranslationLimitError,
  TranslationRefusedError,
  protectArticleCodeSelection,
  translateArticleDocument,
  translateArticleMetadata,
  translateText,
  translationRequestSchema,
} from "@/lib/ai/translation";
import { readJsonBody } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const maxDuration = 300;

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const parsedBody = await readJsonBody(request, { maxBytes: 64 * 1024 });
  if (parsedBody.response) return parsedBody.response;
  const parsedRequest = translationRequestSchema.safeParse(parsedBody.body);
  if (!parsedRequest.success) {
    return NextResponse.json({ error: "Check the text, article, target language, and translation style." }, { status: 400 });
  }
  const input = parsedRequest.data;

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
    console.error("Translation requires a configured Supabase server client.", error);
    return NextResponse.json({ error: "The translation service is not configured yet." }, { status: 503 });
  }

  const rateLimitResponse = await checkAiRateLimit(request, userId, {
    bucketPrefix: "translate",
    authenticatedLimit: 12,
    anonymousLimit: 6,
    featureName: "Translation",
  });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    if (input.kind === "response") {
      const translation = await translateText(input.text, input);
      return NextResponse.json({ kind: "text", translation }, { headers: noStoreHeaders });
    }

    const { data: article, error } = await supabase
      .from("articles")
      .select("title, summary, content")
      .eq("slug", input.articleSlug)
      .eq("status", "published")
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: "Unable to load the published article." }, { status: 502 });
    }
    if (!article) {
      return NextResponse.json({ error: "Published article not found." }, { status: 404 });
    }

    if (input.kind === "selection") {
      const articleText = extractArticleText(article.content);
      if (!normalizeArticleText(articleText).includes(normalizeArticleText(input.selection))) {
        return NextResponse.json({ error: "The selected text does not match this article." }, { status: 400 });
      }
      const protectedSelection = protectArticleCodeSelection(input.selection, article.content);
      if (!protectedSelection.hasTranslatableText) {
        return NextResponse.json({ kind: "text", translation: input.selection, unchanged: true }, { headers: noStoreHeaders });
      }
      const translation = await translateText(protectedSelection.text, input, protectedSelection.protectedValues);
      return NextResponse.json({ kind: "text", translation }, { headers: noStoreHeaders });
    }

    const translatedContent = await translateArticleDocument(article.content, input);
    const translatedMetadata = await translateArticleMetadata(article.title, article.summary, input);
    return NextResponse.json({
      kind: "document",
      content: translatedContent,
      title: translatedMetadata.title,
      summary: translatedMetadata.summary,
    }, { headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof TranslationRefusedError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof TranslationLimitError) {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }
    if (error instanceof TranslationFormatError) {
      console.error("Translation response could not be safely applied.", error.message);
      return NextResponse.json({ error: "The local model returned an invalid translation. Try again or choose a shorter passage." }, { status: 502 });
    }
    if (error instanceof OllamaRequestError) {
      console.error("Ollama translation request failed.", error.code);
      return NextResponse.json(
        {
          error: error.code === "timeout"
            ? "The translation took too long. Try a shorter passage or try again."
            : "The local translation model is unavailable. Check that Ollama is running and the configured model is installed.",
        },
        { status: error.code === "timeout" ? 504 : 503 },
      );
    }
    console.error("Unexpected translation failure.", error);
    return NextResponse.json({ error: "Unable to translate this content right now." }, { status: 500 });
  }
}

const noStoreHeaders = { "Cache-Control": "private, no-store" };

function isSameOriginRequest(request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

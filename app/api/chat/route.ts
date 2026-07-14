import { NextRequest, NextResponse } from "next/server";
import { streamText } from "ai";

import { auth } from "@/app/api/auth";
import { getServerSideConfig } from "@/app/config/server";
import { ACCESS_CODE_PREFIX } from "@/app/constant";
import { prettyObject } from "@/app/utils/format";
import { isModelNotavailableInServer } from "@/app/utils/model";

import { createServerChatModel, resolveProvider } from "../ai-sdk/provider";
import { toModelMessages, type OpenAIStyleMessage } from "../ai-sdk/messages";

const serverConfig = getServerSideConfig();

// Default Google safety settings — do not block content, matching NextChat's
// historical behavior so reasoning / multimodal image output is not filtered.
const GOOGLE_SAFETY_SETTINGS = [
  "HARM_CATEGORY_HARASSMENT",
  "HARM_CATEGORY_HATE_SPEECH",
  "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  "HARM_CATEGORY_DANGEROUS_CONTENT",
  "HARM_CATEGORY_CIVIC_INTEGRITY",
].map((category) => ({ category, threshold: "BLOCK_NONE" }));

interface ChatRequestBody {
  provider: string;
  model: string;
  messages: OpenAIStyleMessage[];
  config?: {
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    presence_penalty?: number;
    frequency_penalty?: number;
  };
  providerOptions?: Record<string, Record<string, any>>;
}

/** Extract a user-supplied API key from the incoming Authorization header. */
function extractUserApiKey(req: NextRequest): string {
  const token = (req.headers.get("Authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token || token.startsWith(ACCESS_CODE_PREFIX)) return "";
  return token;
}

export async function POST(req: NextRequest) {
  if (req.method === "OPTIONS") {
    return NextResponse.json({ body: "OK" }, { status: 200 });
  }

  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch (e) {
    return NextResponse.json(
      { error: true, message: "invalid request body" },
      { status: 400 },
    );
  }

  const { provider, model, messages, config, providerOptions } = body;
  if (!provider || !model || !Array.isArray(messages)) {
    return NextResponse.json(
      { error: true, message: "missing provider, model or messages" },
      { status: 400 },
    );
  }

  const resolved = resolveProvider(provider);

  // Capture the user's own key (if any) before auth() may overwrite the header.
  const userApiKey = extractUserApiKey(req);

  const authResult = auth(req, resolved.modelProvider);
  if (authResult.error) {
    return NextResponse.json(authResult, { status: 401 });
  }

  // Refuse models disabled via CUSTOM_MODELS, mirroring the legacy proxy routes.
  if (
    serverConfig.customModels &&
    isModelNotavailableInServer(serverConfig.customModels, model, provider)
  ) {
    return NextResponse.json(
      { error: true, message: `you are not allowed to use ${model} model` },
      { status: 403 },
    );
  }

  const apiKey = userApiKey || resolved.serverApiKey;
  if (!apiKey) {
    return NextResponse.json(
      { error: true, message: `missing api key for ${provider}` },
      { status: 401 },
    );
  }

  try {
    const languageModel = createServerChatModel({ resolved, model, apiKey });

    // Default Google safety settings unless the client supplied its own.
    const effectiveProviderOptions =
      resolved.kind === "google" && !providerOptions?.google
        ? {
            ...providerOptions,
            google: { safetySettings: GOOGLE_SAFETY_SETTINGS },
          }
        : providerOptions;

    const result = streamText({
      model: languageModel,
      messages: toModelMessages(messages),
      temperature: config?.temperature,
      topP: config?.top_p,
      presencePenalty: config?.presence_penalty,
      frequencyPenalty: config?.frequency_penalty,
      maxOutputTokens: config?.max_tokens,
      abortSignal: req.signal,
      providerOptions: effectiveProviderOptions,
    });

    // Stream text + reasoning + generated files (images) back to the client's
    // `useChat`. `sendReasoning` forwards <think> deltas as reasoning parts.
    return result.toUIMessageStreamResponse({
      sendReasoning: true,
      onError: (error) =>
        error instanceof Error ? error.message : String(error),
    });
  } catch (e) {
    console.error("[Chat] ", e);
    return NextResponse.json(prettyObject(e), { status: 500 });
  }
}

export const runtime = "nodejs";

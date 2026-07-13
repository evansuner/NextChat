"use client";

import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createDeepSeek } from "@ai-sdk/deepseek";
import type { LanguageModel } from "ai";

import { fetch as appFetch } from "@/app/utils/stream";

/**
 * Which Vercel AI SDK provider constructor to use for a given NextChat provider.
 *
 * Because NextChat does not use the Vercel AI Gateway, every provider builds its
 * own client via the corresponding `createXxx` factory (per the request). The
 * clients are pointed at the SAME base URL that each platform's existing
 * `path()` resolves (proxy route, custom endpoint, Cloudflare gateway, or direct
 * API) and receive the SAME auth headers that `getHeaders()` computes, so the
 * access-code proxy scheme, custom keys and Azure/OpenAI routing all keep
 * working unchanged.
 */
export type AiSdkProviderKind =
  | "openai"
  | "openai-compatible"
  | "anthropic"
  | "google"
  | "deepseek";

export interface CreateChatModelParams {
  kind: AiSdkProviderKind;
  /** Model id, e.g. "gpt-4o-mini", "deepseek-chat", "claude-3-5-sonnet-latest". */
  model: string;
  /**
   * Base URL for the provider, WITHOUT the endpoint suffix that the AI SDK
   * appends itself:
   *  - openai / openai-compatible: `.../v1`   (SDK appends `/chat/completions`)
   *  - anthropic:                  `.../v1`   (SDK appends `/messages`)
   *  - google:                     `.../v1beta`
   */
  baseURL: string;
  /** Auth + content headers, typically the result of `getHeaders()`. */
  headers: Record<string, string>;
  /** Human-readable provider name (required by openai-compatible). */
  name?: string;
}

// The auth header is supplied through `headers`, so the SDK's own apiKey option
// only needs to be a non-empty placeholder to satisfy its lazy key validation.
const PLACEHOLDER_API_KEY = "nextchat-proxy";

/**
 * The AI SDK provider clients call `new URL(baseURL)` internally, which throws
 * ("Failed to construct 'URL': Invalid URL") on the relative proxy paths that
 * NextChat uses in web mode (e.g. `/api/openai/v1`). Resolve such relative paths
 * against the current origin so the SDK always receives an absolute URL, while
 * leaving already-absolute `http(s)://` URLs untouched.
 */
function toAbsoluteBaseURL(baseURL: string): string {
  if (/^https?:\/\//i.test(baseURL)) return baseURL;
  if (typeof window !== "undefined" && window.location?.origin) {
    return new URL(baseURL, window.location.origin).toString();
  }
  return baseURL;
}

/**
 * Build an AI SDK `LanguageModel` for the given NextChat provider using its
 * dedicated `createXxx` client. Returns a chat-completions style model.
 */
export function createChatModel(params: CreateChatModelParams): LanguageModel {
  const { kind, model, headers, name } = params;
  const baseURL = toAbsoluteBaseURL(params.baseURL);

  switch (kind) {
    case "anthropic": {
      const anthropic = createAnthropic({
        apiKey: PLACEHOLDER_API_KEY,
        baseURL,
        headers,
        fetch: appFetch as unknown as typeof globalThis.fetch,
      });
      return anthropic(model);
    }

    case "google": {
      const google = createGoogleGenerativeAI({
        apiKey: PLACEHOLDER_API_KEY,
        baseURL,
        headers,
        fetch: appFetch as unknown as typeof globalThis.fetch,
      });
      return google(model);
    }

    case "deepseek": {
      const deepseek = createDeepSeek({
        apiKey: PLACEHOLDER_API_KEY,
        baseURL,
        headers,
        fetch: appFetch as unknown as typeof globalThis.fetch,
      });
      return deepseek(model);
    }

    case "openai-compatible": {
      const provider = createOpenAICompatible({
        name: name ?? "openai-compatible",
        baseURL,
        headers,
        fetch: appFetch as unknown as typeof globalThis.fetch,
      });
      return provider.chatModel(model);
    }

    case "openai":
    default: {
      const openai = createOpenAI({
        apiKey: PLACEHOLDER_API_KEY,
        baseURL,
        headers,
        fetch: appFetch as unknown as typeof globalThis.fetch,
      });
      // Force the Chat Completions API (not the Responses API) so requests hit
      // `${baseURL}/chat/completions`, matching NextChat's proxy routes.
      return openai.chat(model);
    }
  }
}

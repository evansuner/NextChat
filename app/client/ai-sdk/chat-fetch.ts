"use client";

import { fetch as appFetch } from "@/app/utils/stream";
import { ServiceProvider } from "@/app/constant";
import { getChatAuthHeaders } from "../api";

export interface ChatFetchConfig {
  temperature?: number;
  top_p?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  max_tokens?: number;
}

export interface ChatFetchParams {
  provider: ServiceProvider | string;
  model: string;
  /** NextChat OpenAI-style messages ({ role, content }). */
  messages: { role: string; content: any }[];
  config?: ChatFetchConfig;
  /** Called with the full accumulated text on each streamed delta. */
  onUpdate?: (text: string) => void;
  signal?: AbortSignal;
}

export interface ChatFetchResult {
  text: string;
  status: number;
}

/**
 * Call the server-side `/api/chat` route for a non-interactive completion
 * (title generation, memory compression, ...) and accumulate the streamed
 * assistant text. Consumes the AI SDK UI-message SSE stream and returns the
 * final text plus the HTTP status, mirroring the old `LLMApi.chat` callback
 * contract (`onUpdate` / status-gated finish) without the UI plumbing.
 */
export async function fetchChatText(
  params: ChatFetchParams,
): Promise<ChatFetchResult> {
  const { provider, model, messages, config, onUpdate, signal } = params;

  const res = await appFetch("/api/chat", {
    method: "POST",
    headers: getChatAuthHeaders(provider as ServiceProvider),
    body: JSON.stringify({ provider, model, messages, config }),
    signal,
  });

  if (!res.ok || !res.body) {
    return { text: "", status: res.status };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  const consumeEvent = (rawEvent: string) => {
    for (const line of rawEvent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const chunk = JSON.parse(data);
        if (chunk?.type === "text-delta" && typeof chunk.delta === "string") {
          text += chunk.delta;
          onUpdate?.(text);
        }
      } catch {
        // ignore malformed keep-alive / partial lines
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      consumeEvent(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 2);
    }
  }
  if (buffer.length > 0) consumeEvent(buffer);

  return { text, status: res.status };
}

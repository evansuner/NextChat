"use client";

import {
  streamText,
  stepCountIs,
  dynamicTool,
  jsonSchema,
  type LanguageModel,
  type ModelMessage,
  type ToolSet,
} from "ai";

import type { ChatOptions, MultimodalContent } from "../api";

type OpenAIStyleMessage = {
  role: string;
  content: string | MultimodalContent[];
};

/**
 * Convert NextChat's OpenAI-style messages (string or multimodal content) into
 * Vercel AI SDK `ModelMessage`s.
 */
function toModelMessages(messages: OpenAIStyleMessage[]): ModelMessage[] {
  return messages.map((m) => {
    // OpenAI's o1/o3 "developer" role maps to a system message for the SDK.
    const role = (m.role === "developer" ? "system" : m.role) as
      | "system"
      | "user"
      | "assistant";

    if (typeof m.content === "string") {
      return { role, content: m.content } as ModelMessage;
    }

    // Multimodal content is only valid on user messages for the SDK.
    if (role === "user") {
      const parts = m.content.map((part) => {
        if (part.type === "image_url" && part.image_url?.url) {
          return { type: "image" as const, image: part.image_url.url };
        }
        return { type: "text" as const, text: part.text ?? "" };
      });
      return { role, content: parts } as ModelMessage;
    }

    const text = m.content
      .map((part) => (part.type === "text" ? (part.text ?? "") : ""))
      .join("");
    return { role, content: text } as ModelMessage;
  });
}

/**
 * Convert NextChat plugin tools (OpenAI function specs + executor map) into an
 * AI SDK `ToolSet`. Each tool's `execute` calls the original plugin function and
 * normalizes its result the same way `streamWithThink` did.
 */
function buildToolSet(
  tools: any[] | undefined,
  funcs: Record<string, Function> | undefined,
): ToolSet | undefined {
  if (!tools?.length || !funcs) return undefined;

  const toolSet: ToolSet = {};
  for (const t of tools) {
    const fn = t?.function;
    const name: string | undefined = fn?.name;
    if (!name || typeof funcs[name] !== "function") continue;

    toolSet[name] = dynamicTool({
      description: fn.description ?? "",
      inputSchema: jsonSchema(
        fn.parameters ?? { type: "object", properties: {} },
      ),
      execute: async (args: unknown) => {
        const res: any = await funcs[name](args ?? {});
        let content = res?.data ?? res?.statusText ?? res;
        content =
          typeof content === "string" ? content : JSON.stringify(content);
        if (typeof res?.status === "number" && res.status >= 300) {
          throw new Error(content);
        }
        return content;
      },
    });
  }

  return Object.keys(toolSet).length ? toolSet : undefined;
}

export interface AISDKStreamConfig {
  model: LanguageModel;
  messages: OpenAIStyleMessage[];
  temperature?: number;
  topP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  maxTokens?: number;
  tools?: any[];
  funcs?: Record<string, Function>;
  controller: AbortController;
  options: ChatOptions;
  /** Max tool-call round trips before stopping. */
  maxSteps?: number;
  /** Abort the request if it does not finish within this many ms. */
  timeoutMs?: number;
  /** Provider-specific options forwarded to `streamText` (e.g. Google safety settings). */
  providerOptions?: Record<string, Record<string, any>>;
}

/**
 * Drive NextChat's existing `ChatOptions` callbacks from an AI SDK `streamText`
 * call. This is the AI SDK equivalent of `utils/chat.ts#streamWithThink`:
 * it keeps the smooth typing animation, renders reasoning deltas as blockquotes,
 * runs the plugin tool loop, and reports finish/error/abort — so the original UI
 * consumes it without any changes.
 */
export function streamWithAISDK(config: AISDKStreamConfig): void {
  const { options, controller } = config;

  let responseText = "";
  let remainText = "";
  let finished = false;
  let isInThinkingMode = false;
  let lastIsThinking = false;

  // A synthetic 200 response so callers that check `responseRes.status` still work.
  const okResponse = { status: 200 } as Response;

  const requestTimeoutId = config.timeoutMs
    ? setTimeout(() => controller.abort(), config.timeoutMs)
    : undefined;

  // Smooth typing animation — identical cadence to streamWithThink.
  function animateResponseText() {
    if (finished || controller.signal.aborted) {
      responseText += remainText;
      remainText = "";
      return;
    }

    if (remainText.length > 0) {
      const fetchCount = Math.max(1, Math.round(remainText.length / 60));
      const fetchText = remainText.slice(0, fetchCount);
      responseText += fetchText;
      remainText = remainText.slice(fetchCount);
      options.onUpdate?.(responseText, fetchText);
    }

    requestAnimationFrame(animateResponseText);
  }

  animateResponseText();

  function appendChunk(content: string, isThinking: boolean) {
    if (!content) return;

    const isThinkingChanged = lastIsThinking !== isThinking;
    lastIsThinking = isThinking;

    if (isThinking) {
      if (!isInThinkingMode || isThinkingChanged) {
        isInThinkingMode = true;
        if (remainText.length > 0) remainText += "\n";
        remainText += "> " + content;
      } else if (content.includes("\n\n")) {
        remainText += content.split("\n\n").join("\n\n> ");
      } else {
        remainText += content;
      }
    } else {
      if (isInThinkingMode || isThinkingChanged) {
        isInThinkingMode = false;
        remainText += "\n\n" + content;
      } else {
        remainText += content;
      }
    }
  }

  const finish = () => {
    if (finished) return;
    finished = true;
    if (requestTimeoutId) clearTimeout(requestTimeoutId);
    options.onFinish(responseText + remainText, okResponse);
  };

  controller.signal.onabort = finish;

  const toolSet = buildToolSet(config.tools, config.funcs);

  (async () => {
    try {
      const result = streamText({
        model: config.model,
        messages: toModelMessages(config.messages),
        temperature: config.temperature,
        topP: config.topP,
        presencePenalty: config.presencePenalty,
        frequencyPenalty: config.frequencyPenalty,
        maxOutputTokens: config.maxTokens,
        tools: toolSet,
        stopWhen: stepCountIs(toolSet ? (config.maxSteps ?? 5) : 1),
        abortSignal: controller.signal,
        providerOptions: config.providerOptions,
      });

      // Track tool call names/args so onAfterTool can report the same shape.
      const toolCalls = new Map<string, { name: string; args: string }>();

      for await (const part of result.fullStream as AsyncIterable<any>) {
        if (finished) break;

        switch (part.type) {
          case "text-delta":
            appendChunk(part.text, false);
            break;

          case "reasoning-delta":
            appendChunk(part.text, true);
            break;

          case "tool-call": {
            const args =
              typeof part.input === "string"
                ? part.input
                : JSON.stringify(part.input ?? {});
            toolCalls.set(part.toolCallId, { name: part.toolName, args });
            options.onBeforeTool?.({
              id: part.toolCallId,
              type: "function",
              function: { name: part.toolName, arguments: args },
            });
            break;
          }

          case "tool-result": {
            const meta = toolCalls.get(part.toolCallId);
            const content =
              typeof part.output === "string"
                ? part.output
                : JSON.stringify(part.output ?? "");
            options.onAfterTool?.({
              id: part.toolCallId,
              type: "function",
              function: { name: meta?.name, arguments: meta?.args },
              content,
              isError: false,
            } as any);
            break;
          }

          case "tool-error": {
            const meta = toolCalls.get(part.toolCallId);
            options.onAfterTool?.({
              id: part.toolCallId,
              type: "function",
              function: { name: meta?.name, arguments: meta?.args },
              isError: true,
              errorMsg: String(part.error),
            } as any);
            break;
          }

          case "error":
            throw part.error;
        }
      }

      finish();
    } catch (e) {
      if (controller.signal.aborted) {
        finish();
        return;
      }
      console.log("[Request] failed to make a chat request", e);
      if (requestTimeoutId) clearTimeout(requestTimeoutId);
      options.onError?.(e as Error);
    }
  })();
}

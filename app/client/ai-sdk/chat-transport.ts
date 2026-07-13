"use client";

import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";
import type { ChatOptions, LLMConfig, RequestMessage } from "../api";
import type { ClientApi } from "../api";
import { ChatControllerPool } from "../controller";

/**
 * What the chat component must resolve for each send: which provider client to
 * use, the fully-assembled request messages (mask/system/memory context prefix
 * + conversation history), and the model config. Keeping this in the component
 * means all request-assembly logic lives in one place; the transport stays a
 * dumb callback→stream adapter.
 */
export interface PreparedChatRequest {
  api: ClientApi;
  messages: RequestMessage[];
  config: LLMConfig;
  /** For registering the abort controller so global stop-all keeps working. */
  sessionId?: string;
  messageId?: string;
}

export type PrepareChatRequest = (
  uiMessages: UIMessage[],
) => Promise<PreparedChatRequest>;

let textPartCounter = 0;
function nextTextId() {
  return `text-${Date.now()}-${textPartCounter++}`;
}

function safeParseJSON(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return input;
  }
}

/**
 * A client-side `ChatTransport` for AI SDK UI's `useChat`. Instead of POSTing to
 * a server route, it drives NextChat's existing per-provider `LLMApi.chat()`
 * (which already streams via the AI SDK internally) and converts its callbacks
 * into the `UIMessageChunk` stream that `useChat` expects. This makes `useChat`
 * the single source of truth for the conversation UI while reusing every
 * provider's auth/proxy/model-selection logic unchanged.
 */
export class NextChatTransport implements ChatTransport<UIMessage> {
  constructor(private readonly prepare: PrepareChatRequest) {}

  async sendMessages(options: {
    trigger: "submit-message" | "regenerate-message";
    chatId: string;
    messageId: string | undefined;
    messages: UIMessage[];
    abortSignal: AbortSignal | undefined;
  }): Promise<ReadableStream<UIMessageChunk>> {
    const { messages, abortSignal } = options;
    const prepared = await this.prepare(messages);
    const { api, messages: reqMessages, config, sessionId, messageId } =
      prepared;

    const textId = nextTextId();

    return new ReadableStream<UIMessageChunk>({
      start(controller) {
        let started = false;
        let closed = false;
        let lastText = "";

        const unregisterController = () => {
          if (sessionId && messageId) {
            ChatControllerPool.remove(sessionId, messageId);
          }
        };

        const ensureStart = () => {
          if (started) return;
          started = true;
          controller.enqueue({
            type: "start",
            messageMetadata: {
              model: config.model,
              date: new Date().toLocaleString(),
            },
          } as UIMessageChunk);
          controller.enqueue({ type: "text-start", id: textId });
        };

        const close = () => {
          if (closed) return;
          closed = true;
          unregisterController();
          try {
            controller.close();
          } catch {
            // stream may already be closed on abort
          }
        };

        const pushDelta = (fullText: string, chunk?: string) => {
          ensureStart();
          const delta =
            typeof chunk === "string" && chunk.length > 0
              ? chunk
              : fullText.slice(lastText.length);
          lastText = fullText;
          if (delta) {
            controller.enqueue({ type: "text-delta", id: textId, delta });
          }
        };

        const chatOptions: ChatOptions = {
          messages: reqMessages,
          config: { ...config, stream: true },
          onUpdate(message, chunk) {
            pushDelta(message, chunk);
          },
          onFinish(message) {
            ensureStart();
            if (message && message.length > lastText.length) {
              controller.enqueue({
                type: "text-delta",
                id: textId,
                delta: message.slice(lastText.length),
              });
              lastText = message;
            }
            controller.enqueue({ type: "text-end", id: textId });
            controller.enqueue({ type: "finish" });
            close();
          },
          onError(err) {
            ensureStart();
            controller.enqueue({ type: "text-end", id: textId });
            controller.enqueue({
              type: "error",
              errorText: err?.message ?? String(err),
            });
            close();
          },
          onBeforeTool(tool) {
            ensureStart();
            controller.enqueue({
              type: "tool-input-available",
              toolCallId: tool.id,
              toolName: tool.function?.name ?? "",
              input: safeParseJSON(tool.function?.arguments ?? "{}"),
              dynamic: true,
            } as UIMessageChunk);
          },
          onAfterTool(tool) {
            if (tool.isError) {
              controller.enqueue({
                type: "tool-output-error",
                toolCallId: tool.id,
                errorText: tool.errorMsg ?? "tool failed",
                dynamic: true,
              } as UIMessageChunk);
            } else {
              controller.enqueue({
                type: "tool-output-available",
                toolCallId: tool.id,
                output: tool.content ?? "",
                dynamic: true,
              } as UIMessageChunk);
            }
          },
          onController(reqController) {
            if (sessionId && messageId) {
              ChatControllerPool.addController(
                sessionId,
                messageId,
                reqController,
              );
            }
            if (!abortSignal) return;
            if (abortSignal.aborted) {
              reqController.abort();
              return;
            }
            abortSignal.addEventListener("abort", () => reqController.abort(), {
              once: true,
            });
          },
        };

        api.llm.chat(chatOptions).catch((err) => {
          if (closed) return;
          ensureStart();
          controller.enqueue({ type: "text-end", id: textId });
          controller.enqueue({
            type: "error",
            errorText: err?.message ?? String(err),
          });
          close();
        });
      },
    });
  }

  async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    // No server-side stream to resume in this client-only transport.
    return null;
  }
}

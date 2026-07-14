"use client";

import type { UIMessage } from "ai";
import type { ChatMessage } from "@/app/store";
import type { ChatMessageTool } from "@/app/store";
import type { MultimodalContent } from "../api";
import { getMessageImages, getMessageTextContent } from "@/app/utils";

/**
 * Bridging layer between NextChat's `ChatMessage` (role + string|multimodal
 * `content`, `tools`, `date`, ...) and the AI SDK UI `UIMessage` (parts-based)
 * used by `useChat`. This lets the AI SDK own the live conversation/streaming
 * state while NextChat's original render layer keeps consuming `ChatMessage`.
 */

type AnyPart = UIMessage["parts"][number] & Record<string, any>;

/**
 * Extract the plain text (with reasoning rendered as blockquotes) from parts.
 * When `includeFileImages` is set, assistant-generated image files are appended
 * as markdown images so multimodal image output renders in the chat.
 */
function partsToText(parts: AnyPart[], includeFileImages = false): string {
  let text = "";
  let inReasoning = false;

  for (const part of parts) {
    if (part.type === "text") {
      if (inReasoning) {
        inReasoning = false;
        text += "\n\n";
      }
      text += part.text ?? "";
    } else if (part.type === "reasoning") {
      // Render reasoning like the previous streaming adapter: as a blockquote.
      const chunk = (part.text ?? "") as string;
      if (!chunk) continue;
      if (!inReasoning) {
        inReasoning = true;
        if (text.length > 0) text += "\n";
        text += "> " + chunk.split("\n\n").join("\n\n> ");
      } else {
        text += chunk.split("\n\n").join("\n\n> ");
      }
    } else if (
      includeFileImages &&
      part.type === "file" &&
      typeof part.url === "string" &&
      (part.mediaType?.startsWith("image") ?? false)
    ) {
      if (inReasoning) {
        inReasoning = false;
        text += "\n\n";
      }
      if (text.length > 0) text += "\n\n";
      text += `![image](${part.url})`;
    }
  }

  return text;
}

/** Extract image data URLs from user file parts. */
function partsToImages(parts: AnyPart[]): string[] {
  return parts
    .filter(
      (p) =>
        p.type === "file" &&
        typeof p.url === "string" &&
        (p.mediaType?.startsWith("image") ?? false),
    )
    .map((p) => p.url as string);
}

/** Map AI SDK tool/dynamic-tool parts to NextChat's `ChatMessageTool` shape. */
function partsToTools(parts: AnyPart[]): ChatMessageTool[] {
  const tools: ChatMessageTool[] = [];
  for (const part of parts) {
    const isDynamic = part.type === "dynamic-tool";
    const isStatic =
      typeof part.type === "string" && part.type.startsWith("tool-");
    if (!isDynamic && !isStatic) continue;

    const name = isDynamic
      ? (part.toolName as string)
      : (part.type as string).slice("tool-".length);
    const args =
      typeof part.input === "string"
        ? part.input
        : JSON.stringify(part.input ?? {});
    const hasOutput = part.output !== undefined && part.output !== null;
    const content = hasOutput
      ? typeof part.output === "string"
        ? part.output
        : JSON.stringify(part.output)
      : undefined;

    tools.push({
      id: part.toolCallId as string,
      type: "function",
      function: { name, arguments: args },
      content,
      isError: !!part.errorText,
      errorMsg: part.errorText as string | undefined,
    });
  }
  return tools;
}

export interface UIToChatOptions {
  /** Whether the AI SDK is currently streaming (marks the trailing assistant). */
  streaming?: boolean;
  /** Fallback model name for assistant messages lacking metadata. */
  model?: string;
}

/**
 * Convert the AI SDK `useChat` message list into NextChat `ChatMessage`s for
 * rendering with the original UI components.
 */
export function uiMessagesToChatMessages(
  uiMessages: UIMessage[],
  options: UIToChatOptions = {},
): ChatMessage[] {
  const lastAssistantIndex = (() => {
    for (let i = uiMessages.length - 1; i >= 0; i--) {
      if (uiMessages[i].role === "assistant") return i;
    }
    return -1;
  })();

  return uiMessages.map((m, index) => {
    const parts = (m.parts ?? []) as AnyPart[];
    const text = partsToText(parts, m.role === "assistant");
    const images = m.role === "user" ? partsToImages(parts) : [];
    const tools = m.role === "assistant" ? partsToTools(parts) : [];
    const metadata = (m.metadata ?? {}) as Record<string, any>;

    let content: string | MultimodalContent[] = text;
    if (images.length > 0) {
      content = [
        { type: "text", text },
        ...images.map((url) => ({
          type: "image_url" as const,
          image_url: { url },
        })),
      ];
    }

    return {
      id: m.id,
      role: m.role,
      content,
      date: metadata.date ?? new Date().toLocaleString(),
      streaming:
        options.streaming === true &&
        m.role === "assistant" &&
        index === lastAssistantIndex,
      model: metadata.model ?? options.model,
      tools: tools.length > 0 ? tools : undefined,
    } as ChatMessage;
  });
}

/**
 * Convert a NextChat `ChatMessage` into an AI SDK `UIMessage` for seeding
 * `useChat` from a persisted session.
 */
export function chatMessageToUIMessage(m: ChatMessage): UIMessage {
  const parts: AnyPart[] = [];

  const text = getMessageTextContent(m);
  if (text) parts.push({ type: "text", text } as AnyPart);

  if (m.role === "user") {
    for (const url of getMessageImages(m)) {
      const mediaType = url.startsWith("data:")
        ? url.slice(5, url.indexOf(";")) || "image/png"
        : "image/png";
      parts.push({ type: "file", mediaType, url } as AnyPart);
    }
  }

  if (parts.length === 0) parts.push({ type: "text", text: "" } as AnyPart);

  return {
    id: m.id,
    role: m.role === "system" ? "system" : m.role,
    metadata: { date: m.date, model: m.model },
    parts,
  } as UIMessage;
}

export function chatMessagesToUIMessages(messages: ChatMessage[]): UIMessage[] {
  return messages.map(chatMessageToUIMessage);
}

/** Extract the plain text (reasoning rendered as blockquotes) from a UIMessage. */
export function extractUIText(message: UIMessage): string {
  return partsToText((message.parts ?? []) as AnyPart[], true);
}

/** Extract NextChat tool records from a UIMessage's tool/dynamic-tool parts. */
export function extractUITools(message: UIMessage): ChatMessageTool[] {
  return partsToTools((message.parts ?? []) as AnyPart[]);
}

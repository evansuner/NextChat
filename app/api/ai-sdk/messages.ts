import type { ModelMessage } from "ai";

/** NextChat OpenAI-style multimodal content part. */
type ContentPart = {
  type: string;
  text?: string;
  image_url?: { url?: string };
};

export type OpenAIStyleMessage = {
  role: string;
  content: string | ContentPart[];
};

/**
 * Convert NextChat's OpenAI-style messages (role + string|multimodal content)
 * into Vercel AI SDK `ModelMessage`s, so server-side `streamText` receives the
 * same input shape the client assembles.
 */
export function toModelMessages(
  messages: OpenAIStyleMessage[],
): ModelMessage[] {
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
          const url = part.image_url.url;
          // AI SDK v5 uses `file` parts (the old `image` part is deprecated).
          const dataUrl = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/s.exec(
            url,
          );
          if (dataUrl) {
            return {
              type: "file" as const,
              mediaType: dataUrl[1],
              data: dataUrl[2],
            };
          }
          return {
            type: "file" as const,
            mediaType: "image/png",
            data: /^https?:\/\//i.test(url) ? new URL(url) : url,
          };
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

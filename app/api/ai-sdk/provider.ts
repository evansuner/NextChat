import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

import { getServerSideConfig } from "@/app/config/server";
import {
  ANTHROPIC_BASE_URL,
  AI302_BASE_URL,
  BAIDU_BASE_URL,
  BYTEDANCE_BASE_URL,
  CHATGLM_BASE_URL,
  DEEPSEEK_BASE_URL,
  GEMINI_BASE_URL,
  IFLYTEK_BASE_URL,
  MOONSHOT_BASE_URL,
  ModelProvider,
  OPENROUTER_BASE_URL,
  OPENAI_BASE_URL,
  ServiceProvider,
  SILICONFLOW_BASE_URL,
  TENCENT_BASE_URL,
  XAI_BASE_URL,
} from "@/app/constant";

type ProviderKind = "openai" | "openai-compatible" | "anthropic" | "google";

interface ResolvedProvider {
  kind: ProviderKind;
  /** Fully-resolved base URL the AI SDK client should point at. */
  baseURL: string;
  /** System API key from server config (may be empty). */
  serverApiKey: string;
  /** ModelProvider used by `auth()` to validate/inject the system key. */
  modelProvider: ModelProvider;
  /** Human-readable name required by the openai-compatible client. */
  name: string;
}

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function join(base: string, suffix: string): string {
  const b = stripTrailingSlash(base);
  if (!suffix) return b;
  return `${b}/${suffix.replace(/^\//, "")}`;
}

/**
 * Resolve the AI SDK provider kind, base URL, system key and auth ModelProvider
 * for a given NextChat `ServiceProvider`, using the server-side config (custom
 * endpoint URL falls back to each provider's public default). The base URL
 * already includes the version suffix the AI SDK client expects to append the
 * endpoint path to (e.g. `/v1`, `/v1beta`).
 */
export function resolveProvider(provider: string): ResolvedProvider {
  const cfg = getServerSideConfig();

  switch (provider) {
    case ServiceProvider.OpenAI:
      return {
        kind: "openai",
        baseURL: join(cfg.baseUrl || OPENAI_BASE_URL, "v1"),
        serverApiKey: cfg.apiKey ?? "",
        modelProvider: ModelProvider.GPT,
        name: "openai",
      };

    case ServiceProvider.Google:
      return {
        kind: "google",
        baseURL: join(cfg.googleUrl || GEMINI_BASE_URL, "v1beta"),
        serverApiKey: cfg.googleApiKey ?? "",
        modelProvider: ModelProvider.GeminiPro,
        name: "google",
      };

    case ServiceProvider.Anthropic:
      return {
        kind: "anthropic",
        baseURL: join(cfg.anthropicUrl || ANTHROPIC_BASE_URL, "v1"),
        serverApiKey: cfg.anthropicApiKey ?? "",
        modelProvider: ModelProvider.Claude,
        name: "anthropic",
      };

    case ServiceProvider.DeepSeek:
      return {
        kind: "openai-compatible",
        baseURL: stripTrailingSlash(cfg.deepseekUrl || DEEPSEEK_BASE_URL),
        serverApiKey: cfg.deepseekApiKey ?? "",
        modelProvider: ModelProvider.DeepSeek,
        name: "deepseek",
      };

    case ServiceProvider.ChatGLM:
      return {
        kind: "openai-compatible",
        baseURL: join(cfg.chatglmUrl || CHATGLM_BASE_URL, "api/paas/v4"),
        serverApiKey: cfg.chatglmApiKey ?? "",
        modelProvider: ModelProvider.ChatGLM,
        name: "chatglm",
      };

    case ServiceProvider.ByteDance:
      return {
        kind: "openai-compatible",
        baseURL: join(cfg.bytedanceUrl || BYTEDANCE_BASE_URL, "api/v3"),
        serverApiKey: cfg.bytedanceApiKey ?? "",
        modelProvider: ModelProvider.Doubao,
        name: "bytedance",
      };

    case ServiceProvider.Moonshot:
      return {
        kind: "openai-compatible",
        baseURL: join(cfg.moonshotUrl || MOONSHOT_BASE_URL, "v1"),
        serverApiKey: cfg.moonshotApiKey ?? "",
        modelProvider: ModelProvider.Moonshot,
        name: "moonshot",
      };

    case ServiceProvider.XAI:
      return {
        kind: "openai-compatible",
        baseURL: join(cfg.xaiUrl || XAI_BASE_URL, "v1"),
        serverApiKey: cfg.xaiApiKey ?? "",
        modelProvider: ModelProvider.XAI,
        name: "xai",
      };

    case ServiceProvider.SiliconFlow:
      return {
        kind: "openai-compatible",
        baseURL: join(cfg.siliconFlowUrl || SILICONFLOW_BASE_URL, "v1"),
        serverApiKey: cfg.siliconFlowApiKey ?? "",
        modelProvider: ModelProvider.SiliconFlow,
        name: "siliconflow",
      };

    case ServiceProvider["302.AI"]:
      return {
        kind: "openai-compatible",
        baseURL: join(cfg.ai302Url || AI302_BASE_URL, "v1"),
        serverApiKey: cfg.ai302ApiKey ?? "",
        modelProvider: ModelProvider["302.AI"],
        name: "ai302",
      };

    case ServiceProvider.OpenRouter:
      return {
        kind: "openai-compatible",
        baseURL: join(cfg.openrouterUrl || OPENROUTER_BASE_URL, "v1"),
        serverApiKey: cfg.openrouterApiKey ?? "",
        modelProvider: ModelProvider.OpenRouter,
        name: "openrouter",
      };

    case ServiceProvider.Iflytek:
      return {
        kind: "openai-compatible",
        baseURL: join(cfg.iflytekUrl || IFLYTEK_BASE_URL, "v1"),
        serverApiKey:
          cfg.iflytekApiKey && cfg.iflytekApiSecret
            ? `${cfg.iflytekApiKey}:${cfg.iflytekApiSecret}`
            : (cfg.iflytekApiKey ?? ""),
        modelProvider: ModelProvider.Iflytek,
        name: "iflytek",
      };

    case ServiceProvider.Alibaba:
      // DashScope's OpenAI-compatible endpoint (not the native DashScope path).
      return {
        kind: "openai-compatible",
        baseURL: cfg.alibabaUrl
          ? join(cfg.alibabaUrl, "v1")
          : "https://dashscope.aliyuncs.com/compatible-mode/v1",
        serverApiKey: cfg.alibabaApiKey ?? "",
        modelProvider: ModelProvider.Qwen,
        name: "alibaba",
      };

    // Best-effort OpenAI-compatible endpoints. Baidu/Tencent originally used
    // bespoke auth (OAuth token / HMAC signing); their compatible-mode
    // endpoints accept a bearer API key.
    case ServiceProvider.Baidu:
      return {
        kind: "openai-compatible",
        baseURL: cfg.baiduUrl
          ? join(cfg.baiduUrl, "v2")
          : join(BAIDU_BASE_URL, "v2"),
        serverApiKey: cfg.baiduApiKey ?? "",
        modelProvider: ModelProvider.Ernie,
        name: "baidu",
      };

    case ServiceProvider.Tencent:
      return {
        kind: "openai-compatible",
        baseURL: cfg.tencentUrl
          ? join(cfg.tencentUrl, "v1")
          : join(TENCENT_BASE_URL, "v1"),
        serverApiKey: cfg.tencentSecretKey ?? "",
        modelProvider: ModelProvider.Hunyuan,
        name: "tencent",
      };

    default:
      // Fall back to an OpenAI-compatible client pointed at the OpenAI base.
      return {
        kind: "openai",
        baseURL: join(cfg.baseUrl || OPENAI_BASE_URL, "v1"),
        serverApiKey: cfg.apiKey ?? "",
        modelProvider: ModelProvider.GPT,
        name: "openai",
      };
  }
}

/**
 * Build an AI SDK `LanguageModel` for the given provider/model using the
 * resolved base URL and the effective API key (a user-supplied key overrides
 * the server system key).
 */
export function createServerChatModel(params: {
  resolved: ResolvedProvider;
  model: string;
  apiKey: string;
}): LanguageModel {
  const { resolved, model, apiKey } = params;
  const { kind, baseURL, name } = resolved;

  switch (kind) {
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey, baseURL });
      return anthropic(model);
    }

    case "google": {
      const google = createGoogleGenerativeAI({ apiKey, baseURL });
      return google(model);
    }

    case "openai-compatible": {
      const provider = createOpenAICompatible({ name, apiKey, baseURL });
      return provider.chatModel(model);
    }

    case "openai":
    default: {
      const openai = createOpenAI({ apiKey, baseURL });
      // Force the Chat Completions API (not the Responses API) so requests hit
      // `${baseURL}/chat/completions`.
      return openai.chat(model);
    }
  }
}

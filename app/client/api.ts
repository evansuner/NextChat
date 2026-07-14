import {
  ACCESS_CODE_PREFIX,
  ModelProvider,
  ServiceProvider,
} from "../constant";
import {
  ChatMessageTool,
  ChatMessage,
  ModelType,
  useAccessStore,
  useChatStore,
} from "../store";
import { ChatGPTApi } from "./platforms/openai";
import { GeminiProApi } from "./platforms/google";
import { ClaudeApi } from "./platforms/anthropic";
import { ErnieApi } from "./platforms/baidu";
import { DoubaoApi } from "./platforms/bytedance";
import { QwenApi } from "./platforms/alibaba";
import { HunyuanApi } from "./platforms/tencent";
import { MoonshotApi } from "./platforms/moonshot";
import { SparkApi } from "./platforms/iflytek";
import { DeepSeekApi } from "./platforms/deepseek";
import { XAIApi } from "./platforms/xai";
import { ChatGLMApi } from "./platforms/glm";
import { SiliconflowApi } from "./platforms/siliconflow";
import { Ai302Api } from "./platforms/ai302";
import { OpenRouterApi } from "./platforms/openrouter";
import { ModelSize } from "../typing";

export const ROLES = ["system", "user", "assistant"] as const;
export type MessageRole = (typeof ROLES)[number];

export const Models = ["gpt-3.5-turbo", "gpt-4"] as const;
export type ChatModel = ModelType;

export interface MultimodalContent {
  type: "text" | "image_url";
  text?: string;
  image_url?: {
    url: string;
  };
}

export interface MultimodalContentForAlibaba {
  text?: string;
  image?: string;
}

export interface RequestMessage {
  role: MessageRole;
  content: string | MultimodalContent[];
}

export interface LLMConfig {
  model: string;
  providerName?: string;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  presence_penalty?: number;
  frequency_penalty?: number;
  size?: ModelSize;
}

export interface ChatOptions {
  messages: RequestMessage[];
  config: LLMConfig;

  onUpdate?: (message: string, chunk: string) => void;
  onFinish: (message: string, responseRes: Response) => void;
  onError?: (err: Error) => void;
  onController?: (controller: AbortController) => void;
  onBeforeTool?: (tool: ChatMessageTool) => void;
  onAfterTool?: (tool: ChatMessageTool) => void;
}

export interface LLMModel {
  name: string;
  displayName?: string;
  available: boolean;
  provider: LLMModelProvider;
  sorted: number;
}

export interface LLMModelProvider {
  id: string;
  providerName: string;
  providerType: string;
  sorted: number;
}

export abstract class LLMApi {
  abstract models(): Promise<LLMModel[]>;
}

type ProviderName = "openai" | "azure" | "claude" | "palm";

interface Model {
  name: string;
  provider: ProviderName;
  ctxlen: number;
}

interface ChatProvider {
  name: ProviderName;
  apiConfig: {
    baseUrl: string;
    apiKey: string;
    summaryModel: Model;
  };
  models: Model[];

  chat: () => void;
  usage: () => void;
}

export class ClientApi {
  public llm: LLMApi;

  constructor(provider: ModelProvider = ModelProvider.GPT) {
    switch (provider) {
      case ModelProvider.GeminiPro:
        this.llm = new GeminiProApi();
        break;
      case ModelProvider.Claude:
        this.llm = new ClaudeApi();
        break;
      case ModelProvider.Ernie:
        this.llm = new ErnieApi();
        break;
      case ModelProvider.Doubao:
        this.llm = new DoubaoApi();
        break;
      case ModelProvider.Qwen:
        this.llm = new QwenApi();
        break;
      case ModelProvider.Hunyuan:
        this.llm = new HunyuanApi();
        break;
      case ModelProvider.Moonshot:
        this.llm = new MoonshotApi();
        break;
      case ModelProvider.Iflytek:
        this.llm = new SparkApi();
        break;
      case ModelProvider.DeepSeek:
        this.llm = new DeepSeekApi();
        break;
      case ModelProvider.XAI:
        this.llm = new XAIApi();
        break;
      case ModelProvider.ChatGLM:
        this.llm = new ChatGLMApi();
        break;
      case ModelProvider.SiliconFlow:
        this.llm = new SiliconflowApi();
        break;
      case ModelProvider["302.AI"]:
        this.llm = new Ai302Api();
        break;
      case ModelProvider.OpenRouter:
        this.llm = new OpenRouterApi();
        break;
      default:
        this.llm = new ChatGPTApi();
    }
  }

  config() {}

  prompts() {}

  masks() {}

  async share(messages: ChatMessage[], avatarUrl: string | null = null) {
    const msgs = messages
      .map((m) => ({
        from: m.role === "user" ? "human" : "gpt",
        value: m.content,
      }))
      .concat([
        {
          from: "human",
          value:
            "Share from [NextChat]: https://github.com/Yidadaa/ChatGPT-Next-Web",
        },
      ]);
    // 敬告二开开发者们，为了开源大模型的发展，请不要修改上述消息，此消息用于后续数据清洗使用
    // Please do not modify this message

    console.log("[Share]", messages, msgs);
    const shareUrl = "/sharegpt";
    const res = await fetch(shareUrl, {
      body: JSON.stringify({
        avatarUrl,
        items: msgs,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    const resJson = await res.json();
    console.log("[Share]", resJson);
    if (resJson.id) {
      return `https://shareg.pt/${resJson.id}`;
    }
  }
}

export function getBearerToken(
  apiKey: string,
  noBearer: boolean = false,
): string {
  return validString(apiKey)
    ? `${noBearer ? "" : "Bearer "}${apiKey.trim()}`
    : "";
}

export function validString(x: string): boolean {
  return x?.length > 0;
}

export function getHeaders(ignoreHeaders: boolean = false) {
  const accessStore = useAccessStore.getState();
  const chatStore = useChatStore.getState();
  let headers: Record<string, string> = {};
  if (!ignoreHeaders) {
    headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  function getConfig() {
    const modelConfig = chatStore.currentSession().mask.modelConfig;
    const providerName = modelConfig.providerName as ServiceProvider;
    const isBaidu = providerName === ServiceProvider.Baidu;
    const isEnabledAccessControl = accessStore.enabledAccessControl();

    const providerApiKeys: Partial<Record<ServiceProvider, string>> = {
      [ServiceProvider.Google]: accessStore.googleApiKey,
      [ServiceProvider.Azure]: accessStore.azureApiKey,
      [ServiceProvider.Anthropic]: accessStore.anthropicApiKey,
      [ServiceProvider.ByteDance]: accessStore.bytedanceApiKey,
      [ServiceProvider.Alibaba]: accessStore.alibabaApiKey,
      [ServiceProvider.Moonshot]: accessStore.moonshotApiKey,
      [ServiceProvider.XAI]: accessStore.xaiApiKey,
      [ServiceProvider.DeepSeek]: accessStore.deepseekApiKey,
      [ServiceProvider.ChatGLM]: accessStore.chatglmApiKey,
      [ServiceProvider.SiliconFlow]: accessStore.siliconflowApiKey,
      [ServiceProvider["302.AI"]]: accessStore.ai302ApiKey,
      [ServiceProvider.OpenRouter]: accessStore.openrouterApiKey,
    };

    const iflytekApiKey =
      accessStore.iflytekApiKey && accessStore.iflytekApiSecret
        ? `${accessStore.iflytekApiKey}:${accessStore.iflytekApiSecret}`
        : "";

    const apiKey =
      providerName === ServiceProvider.Iflytek
        ? iflytekApiKey
        : (providerApiKeys[providerName] ?? accessStore.openaiApiKey);

    return {
      providerName,
      isBaidu,
      apiKey,
      isEnabledAccessControl,
    };
  }

  function getAuthHeader(providerName: ServiceProvider): string {
    switch (providerName) {
      case ServiceProvider.Azure:
        return "api-key";
      case ServiceProvider.Anthropic:
        return "x-api-key";
      case ServiceProvider.Google:
        return "x-goog-api-key";
      default:
        return "Authorization";
    }
  }

  const { providerName, apiKey, isEnabledAccessControl } = getConfig();

  const authHeader = getAuthHeader(providerName);

  const noBearerProvider =
    providerName === ServiceProvider.Azure ||
    providerName === ServiceProvider.Anthropic ||
    providerName === ServiceProvider.Google;

  const bearerToken = getBearerToken(apiKey, noBearerProvider);

  if (bearerToken) {
    headers[authHeader] = bearerToken;
  } else if (isEnabledAccessControl && validString(accessStore.accessCode)) {
    headers["Authorization"] = getBearerToken(
      ACCESS_CODE_PREFIX + accessStore.accessCode,
    );
  }

  return headers;
}

/**
 * Auth headers for the server-side `/api/chat` route. Sends the provider's
 * user-supplied API key when present, otherwise the access code (prefixed),
 * always as a single `Authorization: Bearer` token that the route's `auth()`
 * validates and forwards to the AI SDK provider client.
 */
export function getChatAuthHeaders(
  providerName: ServiceProvider,
): Record<string, string> {
  const accessStore = useAccessStore.getState();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const providerApiKeys: Partial<Record<ServiceProvider, string>> = {
    [ServiceProvider.Google]: accessStore.googleApiKey,
    [ServiceProvider.Azure]: accessStore.azureApiKey,
    [ServiceProvider.Anthropic]: accessStore.anthropicApiKey,
    [ServiceProvider.ByteDance]: accessStore.bytedanceApiKey,
    [ServiceProvider.Alibaba]: accessStore.alibabaApiKey,
    [ServiceProvider.Moonshot]: accessStore.moonshotApiKey,
    [ServiceProvider.XAI]: accessStore.xaiApiKey,
    [ServiceProvider.DeepSeek]: accessStore.deepseekApiKey,
    [ServiceProvider.ChatGLM]: accessStore.chatglmApiKey,
    [ServiceProvider.SiliconFlow]: accessStore.siliconflowApiKey,
    [ServiceProvider["302.AI"]]: accessStore.ai302ApiKey,
    [ServiceProvider.OpenRouter]: accessStore.openrouterApiKey,
  };

  const iflytekApiKey =
    accessStore.iflytekApiKey && accessStore.iflytekApiSecret
      ? `${accessStore.iflytekApiKey}:${accessStore.iflytekApiSecret}`
      : "";

  const userApiKey =
    providerName === ServiceProvider.Iflytek
      ? iflytekApiKey
      : (providerApiKeys[providerName] ?? accessStore.openaiApiKey);

  if (validString(userApiKey)) {
    headers["Authorization"] = `Bearer ${userApiKey.trim()}`;
  } else if (
    accessStore.enabledAccessControl() &&
    validString(accessStore.accessCode)
  ) {
    headers["Authorization"] =
      `Bearer ${ACCESS_CODE_PREFIX}${accessStore.accessCode}`;
  }

  return headers;
}

export function getClientApi(provider: ServiceProvider): ClientApi {
  switch (provider) {
    case ServiceProvider.Google:
      return new ClientApi(ModelProvider.GeminiPro);
    case ServiceProvider.Anthropic:
      return new ClientApi(ModelProvider.Claude);
    case ServiceProvider.Baidu:
      return new ClientApi(ModelProvider.Ernie);
    case ServiceProvider.ByteDance:
      return new ClientApi(ModelProvider.Doubao);
    case ServiceProvider.Alibaba:
      return new ClientApi(ModelProvider.Qwen);
    case ServiceProvider.Tencent:
      return new ClientApi(ModelProvider.Hunyuan);
    case ServiceProvider.Moonshot:
      return new ClientApi(ModelProvider.Moonshot);
    case ServiceProvider.Iflytek:
      return new ClientApi(ModelProvider.Iflytek);
    case ServiceProvider.DeepSeek:
      return new ClientApi(ModelProvider.DeepSeek);
    case ServiceProvider.XAI:
      return new ClientApi(ModelProvider.XAI);
    case ServiceProvider.ChatGLM:
      return new ClientApi(ModelProvider.ChatGLM);
    case ServiceProvider.SiliconFlow:
      return new ClientApi(ModelProvider.SiliconFlow);
    case ServiceProvider["302.AI"]:
      return new ClientApi(ModelProvider["302.AI"]);
    case ServiceProvider.OpenRouter:
      return new ClientApi(ModelProvider.OpenRouter);
    default:
      return new ClientApi(ModelProvider.GPT);
  }
}

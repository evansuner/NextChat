"use client";

import { ApiPath, DEFAULT_MODELS, ServiceProvider } from "@/app/constant";
import { useAccessStore } from "@/app/store";
import { getChatAuthHeaders, LLMApi, LLMModel } from "../api";

import { fetch } from "@/app/utils/stream";
export interface Ai302ListModelResponse {
  object: string;
  data: Array<{
    id: string;
    object: string;
    root: string;
  }>;
}

export class Ai302Api implements LLMApi {
  private disableListModels = false;

  path(path: string): string {
    const accessStore = useAccessStore.getState();

    let baseUrl = "";

    if (accessStore.useCustomConfig) {
      baseUrl = accessStore.ai302Url;
    }

    if (baseUrl.length === 0) {
      baseUrl = ApiPath["302.AI"];
    }

    if (baseUrl.endsWith("/")) {
      baseUrl = baseUrl.slice(0, baseUrl.length - 1);
    }
    if (!baseUrl.startsWith("http") && !baseUrl.startsWith(ApiPath["302.AI"])) {
      baseUrl = "https://" + baseUrl;
    }

    console.log("[Proxy Endpoint] ", baseUrl, path);

    return [baseUrl, path].join("/");
  }

  extractMessage(res: any) {
    return res.choices?.at(0)?.message?.content ?? "";
  }

  async models(): Promise<LLMModel[]> {
    if (this.disableListModels) {
      return DEFAULT_MODELS.slice();
    }

    const res = await fetch("/api/models?provider=302.AI", {
      method: "GET",
      headers: getChatAuthHeaders(ServiceProvider["302.AI"]),
    });

    const resJson = (await res.json()) as Ai302ListModelResponse;
    const chatModels = resJson.data;
    console.log("[Models]", chatModels);

    if (!chatModels) {
      return [];
    }

    let seq = 1000; //同 Constant.ts 中的排序保持一致
    return chatModels.map((m) => ({
      name: m.id,
      available: true,
      sorted: seq++,
      provider: {
        id: "ai302",
        providerName: "302.AI",
        providerType: "ai302",
        sorted: 15,
      },
    }));
  }
}

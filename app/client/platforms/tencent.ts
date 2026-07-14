"use client";
import { ApiPath } from "@/app/constant";
import { useAccessStore } from "@/app/store";

import { LLMApi, LLMModel } from "../api";

export interface OpenAIListModelResponse {
  object: string;
  data: Array<{
    id: string;
    object: string;
    root: string;
  }>;
}

export class HunyuanApi implements LLMApi {
  path(): string {
    const accessStore = useAccessStore.getState();

    let baseUrl = "";

    if (accessStore.useCustomConfig) {
      baseUrl = accessStore.tencentUrl;
    }

    if (baseUrl.length === 0) {
      baseUrl = ApiPath.Tencent;
    }

    if (baseUrl.endsWith("/")) {
      baseUrl = baseUrl.slice(0, baseUrl.length - 1);
    }
    if (!baseUrl.startsWith("http") && !baseUrl.startsWith(ApiPath.Tencent)) {
      baseUrl = "https://" + baseUrl;
    }

    console.log("[Proxy Endpoint] ", baseUrl);
    return baseUrl;
  }

  extractMessage(res: any) {
    return res.Choices?.at(0)?.Message?.Content ?? "";
  }

  async models(): Promise<LLMModel[]> {
    return [];
  }
}

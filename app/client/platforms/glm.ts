"use client";
import { ApiPath } from "@/app/constant";
import { useAccessStore } from "@/app/store";
import { LLMApi, LLMModel } from "../api";

export class ChatGLMApi implements LLMApi {
  path(path: string): string {
    const accessStore = useAccessStore.getState();
    let baseUrl = "";

    if (accessStore.useCustomConfig) {
      baseUrl = accessStore.chatglmUrl;
    }

    if (baseUrl.length === 0) {
      baseUrl = ApiPath.ChatGLM;
    }

    if (baseUrl.endsWith("/")) {
      baseUrl = baseUrl.slice(0, baseUrl.length - 1);
    }
    if (!baseUrl.startsWith("http") && !baseUrl.startsWith(ApiPath.ChatGLM)) {
      baseUrl = "https://" + baseUrl;
    }

    console.log("[Proxy Endpoint] ", baseUrl, path);
    return [baseUrl, path].join("/");
  }

  extractMessage(res: any) {
    return res.choices?.at(0)?.message?.content ?? "";
  }

  async models(): Promise<LLMModel[]> {
    return [];
  }
}

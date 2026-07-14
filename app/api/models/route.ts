import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/app/api/auth";
import { ACCESS_CODE_PREFIX } from "@/app/constant";

import { resolveProvider } from "../ai-sdk/provider";

/**
 * Model-list endpoints (relative to each provider's resolved base URL, which
 * already ends with the version segment, e.g. `.../v1`). Only providers that
 * support dynamic model listing are included.
 */
const LIST_PATHS: Record<string, string> = {
  "302.AI": "models?llm=1",
  SiliconFlow: "models?sub_type=chat",
};

function extractUserApiKey(req: NextRequest): string {
  const token = (req.headers.get("Authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token || token.startsWith(ACCESS_CODE_PREFIX)) return "";
  return token;
}

/**
 * Lightweight server route that returns a provider's model list. Replaces the
 * old per-provider proxy handlers for the only providers that still list models
 * dynamically (302.AI, SiliconFlow). Reuses `auth()` for access-code / user-key
 * validation and injects the server-side API key just like `/api/chat`.
 */
export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get("provider") ?? "";
  const listPath = LIST_PATHS[provider];
  if (!listPath) {
    return NextResponse.json(
      { error: true, message: `model listing not supported for ${provider}` },
      { status: 400 },
    );
  }

  const resolved = resolveProvider(provider);
  const userApiKey = extractUserApiKey(req);

  const authResult = auth(req, resolved.modelProvider);
  if (authResult.error) {
    return NextResponse.json(authResult, { status: 401 });
  }

  const apiKey = userApiKey || resolved.serverApiKey;
  if (!apiKey) {
    return NextResponse.json(
      { error: true, message: `missing api key for ${provider}` },
      { status: 401 },
    );
  }

  try {
    const res = await fetch(`${resolved.baseURL}/${listPath}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (e) {
    console.error("[Models] ", e);
    return NextResponse.json(
      { error: true, message: (e as Error).message },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";

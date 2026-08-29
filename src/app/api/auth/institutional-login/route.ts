import { NextRequest, NextResponse } from "next/server";
import { signInInstitutionalAccount } from "@/actions/institutional-login";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

/**
 * 関係者ログイン専用API。
 * Server Actionの応答と画面遷移が競合する経路をなくし、認証結果だけをJSONで返す。
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== request.nextUrl.host) {
        return json({ success: false, code: "invalid_request", error: "ログイン要求を確認できませんでした。" }, 403);
      }
    } catch {
      return json({ success: false, code: "invalid_request", error: "ログイン要求を確認できませんでした。" }, 403);
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, code: "invalid_request", error: "入力内容を確認してください。" }, 400);
  }

  if (!body || typeof body !== "object") {
    return json({ success: false, code: "invalid_request", error: "入力内容を確認してください。" }, 400);
  }

  const { kind, password } = body as { kind?: unknown; password?: unknown };
  if (typeof kind !== "string" || typeof password !== "string" || password.length === 0 || password.length > 256) {
    return json({ success: false, code: "invalid_request", error: "入力内容を確認してください。" }, 400);
  }

  const result = await signInInstitutionalAccount(kind, password);
  return json(result, result.success ? 200 : 401);
}

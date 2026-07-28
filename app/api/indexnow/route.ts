import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_SITE_URL = "https://sports-ai-alpha.vercel.app";
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const MAX_ATTEMPTS = 3;

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, "");
}

function normalizeUrls(input: unknown): string[] {
  const base = siteUrl();
  const baseOrigin = new URL(base).origin;
  const values = Array.isArray(input) ? input : typeof input === "string" ? [input] : [];

  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .map((value) => {
          try {
            const url = new URL(value, base);
            return url.origin === baseOrigin ? url.toString() : "";
          } catch {
            return "";
          }
        })
        .filter(Boolean),
    ),
  ).slice(0, 10000);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type AttemptLog = {
  attempt: number;
  status: number | null;
  ok: boolean;
  message: string;
};

async function sendToIndexNow(urls: string[], key: string) {
  const base = siteUrl();
  const payload = {
    host: new URL(base).host,
    key,
    keyLocation: `${base}/indexnow-key.txt`,
    urlList: urls,
  };
  const attempts: AttemptLog[] = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(INDEXNOW_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      const body = (await response.text().catch(() => "")).slice(0, 500);
      const accepted = response.status === 200 || response.status === 202;

      attempts.push({
        attempt,
        status: response.status,
        ok: accepted,
        message: body || (accepted ? "accepted" : `HTTP ${response.status}`),
      });

      if (accepted) {
        return { success: true, status: response.status, attempts };
      }

      // 인증/요청 형식 오류는 재시도해도 해결되지 않으므로 즉시 중단합니다.
      if ([400, 403, 422].includes(response.status)) break;
    } catch (error) {
      attempts.push({
        attempt,
        status: null,
        ok: false,
        message: error instanceof Error ? error.message : "IndexNow network error",
      });
    }

    if (attempt < MAX_ATTEMPTS) await wait(400 * attempt);
  }

  return {
    success: false,
    status: attempts.at(-1)?.status ?? 502,
    attempts,
  };
}

async function submit(urls: string[]) {
  const key = process.env.INDEXNOW_KEY?.trim();
  if (!key) {
    return NextResponse.json(
      { success: false, message: "INDEXNOW_KEY 환경변수가 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  if (!urls.length) {
    return NextResponse.json({ success: false, message: "제출할 URL이 없습니다." }, { status: 400 });
  }

  const result = await sendToIndexNow(urls, key);
  console.log("[IndexNow]", {
    success: result.success,
    submitted: urls.length,
    status: result.status,
    attempts: result.attempts,
  });

  return NextResponse.json(
    {
      success: result.success,
      submitted: urls.length,
      status: result.status,
      attempts: result.attempts,
      submittedAt: new Date().toISOString(),
      urls,
    },
    { status: result.success ? 200 : 502 },
  );
}

export async function POST(request: NextRequest) {
  const secret = process.env.INDEXNOW_SECRET?.trim();
  if (secret && request.headers.get("x-indexnow-secret") !== secret) {
    return NextResponse.json({ success: false, message: "인증에 실패했습니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  return submit(normalizeUrls(body?.urls ?? body?.url));
}

export async function GET(request: NextRequest) {
  const secret = process.env.INDEXNOW_SECRET?.trim();
  if (secret && request.nextUrl.searchParams.get("secret") !== secret) {
    return NextResponse.json({ success: false, message: "인증에 실패했습니다." }, { status: 401 });
  }

  const urls = request.nextUrl.searchParams.getAll("url");
  return submit(normalizeUrls(urls));
}

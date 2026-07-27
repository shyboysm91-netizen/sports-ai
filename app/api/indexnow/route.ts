import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DEFAULT_SITE_URL = "https://sports-ai-alpha.vercel.app";

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, "");
}

function normalizeUrls(input: unknown): string[] {
  const base = siteUrl();
  const values = Array.isArray(input) ? input : typeof input === "string" ? [input] : [];

  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .map((value) => {
          try {
            const url = new URL(value, base);
            return url.origin === new URL(base).origin ? url.toString() : "";
          } catch {
            return "";
          }
        })
        .filter(Boolean),
    ),
  ).slice(0, 10000);
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

  const base = siteUrl();
  const response = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: new URL(base).host,
      key,
      keyLocation: `${base}/indexnow-key.txt`,
      urlList: urls,
    }),
    cache: "no-store",
  });

  return NextResponse.json(
    {
      success: response.ok,
      submitted: urls.length,
      status: response.status,
      urls,
    },
    { status: response.ok ? 200 : 502 },
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

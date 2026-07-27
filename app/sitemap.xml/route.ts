import { NextResponse } from "next/server";

/**
 * Google Search Console이 언제 요청하더라도 외부 API 호출 없이 즉시 200을
 * 반환하는 안정형 사이트맵입니다. 기존 경기/API/화면 로직에는 관여하지 않습니다.
 */
export const dynamic = "force-static";
export const revalidate = 3600;

const BASE_URL = "https://sports-ai-alpha.vercel.app";

const URLS = [
  { path: "", changefreq: "daily", priority: "1.0" },
  { path: "/game", changefreq: "daily", priority: "0.9" },
  { path: "/mlb-game", changefreq: "daily", priority: "0.9" },
  { path: "/npb-game", changefreq: "daily", priority: "0.9" },
  { path: "/about", changefreq: "monthly", priority: "0.6" },
  { path: "/contact", changefreq: "yearly", priority: "0.5" },
  { path: "/privacy", changefreq: "yearly", priority: "0.4" },
  { path: "/terms", changefreq: "yearly", priority: "0.4" },
] as const;

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function createXml() {
  const lastmod = new Date().toISOString();
  const entries = URLS.map(
    ({ path, changefreq, priority }) => `  <url>
    <loc>${escapeXml(`${BASE_URL}${path}`)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`,
  ).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>`;
}

const RESPONSE_HEADERS = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
  "X-Content-Type-Options": "nosniff",
} as const;

export function GET() {
  return new NextResponse(createXml(), {
    status: 200,
    headers: RESPONSE_HEADERS,
  });
}

// Google/Vercel의 사전 확인 요청도 명시적으로 200 처리합니다.
export function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: RESPONSE_HEADERS,
  });
}

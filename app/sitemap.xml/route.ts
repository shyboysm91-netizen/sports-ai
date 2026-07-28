import { NextResponse } from "next/server";

export const dynamic = "force-static";
export const revalidate = 3600;

const BASE_URL = "https://sports-ai-alpha.vercel.app";

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildSitemapIndex() {
  const lastmod = new Date().toISOString();
  const sitemaps = [
    `${BASE_URL}/sitemap-main.xml`,
    `${BASE_URL}/sitemap-analysis.xml`,
  ];

  const entries = sitemaps
    .map(
      (url) =>
        `  <sitemap>\n    <loc>${escapeXml(url)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </sitemap>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>`;
}

const headers = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
  "X-Content-Type-Options": "nosniff",
} as const;

export function GET() {
  return new NextResponse(buildSitemapIndex(), { status: 200, headers });
}

export function HEAD() {
  return new NextResponse(null, { status: 200, headers });
}

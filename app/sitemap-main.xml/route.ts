import { NextResponse } from "next/server";

export const dynamic = "force-static";
export const revalidate = 3600;

const BASE_URL = "https://xn--6e0by81a7uc94i.kr";

const PAGES = [
  ["", "daily", "1.0"],
  ["/game", "daily", "0.9"],
  ["/mlb-game", "daily", "0.9"],
  ["/npb-game", "daily", "0.9"],
  ["/about", "monthly", "0.6"],
  ["/contact", "yearly", "0.5"],
  ["/privacy", "yearly", "0.4"],
  ["/terms", "yearly", "0.4"],
] as const;

function xmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildSitemap() {
  const lastmod = new Date().toISOString();
  const urls = PAGES.map(
    ([path, changefreq, priority]) => `  <url>\n    <loc>${xmlEscape(`${BASE_URL}${path}`)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`,
  ).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
}

const headers = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
  "X-Content-Type-Options": "nosniff",
} as const;

export function GET() {
  return new NextResponse(buildSitemap(), { status: 200, headers });
}

export function HEAD() {
  return new NextResponse(null, { status: 200, headers });
}

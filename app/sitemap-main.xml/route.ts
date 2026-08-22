import { NextResponse } from "next/server";
import { GUIDE_ARTICLES } from "../lib/guides";

export const dynamic = "force-static";
export const revalidate = 3600;

const BASE_URL = "https://장군분석.kr";

const PAGES: Array<readonly [string,string,string]> = [
  ["", "daily", "1.0"],
  ["/game", "daily", "0.9"],
  ["/mlb-game", "daily", "0.9"],
  ["/npb-game", "daily", "0.9"],
  ["/players", "daily", "0.9"],
  ["/players/kbo", "daily", "0.8"],
  ["/players/mlb", "daily", "0.8"],
  ["/players/npb", "daily", "0.8"],
  ["/football", "daily", "0.9"],
  ["/news", "hourly", "0.9"],
  ["/about", "monthly", "0.6"],
  ["/contact", "yearly", "0.5"],
  ["/privacy", "yearly", "0.4"],
  ["/terms", "yearly", "0.4"],
  ["/guide", "weekly", "0.8"],
  ["/guide/how-it-works", "monthly", "0.7"],
  ["/guide/bullpen-fatigue", "monthly", "0.7"],
  ["/guide/whip", "monthly", "0.7"],
  ["/guide/ops", "monthly", "0.7"],
  ...GUIDE_ARTICLES.map((guide)=>[`/guide/${guide.slug}`,"monthly","0.7"] as const),
];

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

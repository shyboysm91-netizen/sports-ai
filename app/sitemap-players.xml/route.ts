import { NextResponse } from "next/server";
import { loadAllPlayers } from "../lib/player-directory";

export const revalidate = 1800;

const BASE_URL = "https://장군분석.kr";

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export async function GET() {
  const { all } = await loadAllPlayers();
  const lastmod = new Date().toISOString();
  const urls = new Set(all.map((player) => `${BASE_URL}/player/${player.league}/${player.id}`));
  const entries = [...urls].map((url) => `  <url>\n    <loc>${escapeXml(url)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.7</priority>\n  </url>`).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>`;
  return new NextResponse(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=1800, stale-while-revalidate=86400", "X-Content-Type-Options": "nosniff" } });
}

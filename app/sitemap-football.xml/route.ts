import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://www.xn--6e0by81a7uc94i.kr").replace(/\/$/, "");

function dateAt(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(date);
}

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

async function games(date: string) {
  const path = `/api/football?date=${date}`;
  const url = `${BASE_URL}/api/data-cache?path=${encodeURIComponent(path)}&ttl=21600`;
  const response = await fetch(url, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) return [];
  const payload = await response.json();
  return Array.isArray(payload?.games) ? payload.games : [];
}

export async function GET() {
  const dates = Array.from({ length: 9 }, (_, index) => dateAt(index - 1));
  const schedules = await Promise.all(dates.map(async (date) => ({ date, games: await games(date).catch(() => []) })));
  const entries = schedules.flatMap(({ date, games }) => games.flatMap((game: any) => {
    if (!game?.id || !game?.league || !game?.home || !game?.away) return [];
    const matchup = encodeURIComponent(`${game.home}-대-${game.away}`);
    const loc = `${BASE_URL}/football/analysis/${encodeURIComponent(game.league)}/${encodeURIComponent(game.date || date)}/${encodeURIComponent(game.id)}/${matchup}`;
    return [`  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${new Date().toISOString()}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>`];
  }));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>`;
  return new NextResponse(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400" } });
}

export function HEAD() {
  return new NextResponse(null, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}

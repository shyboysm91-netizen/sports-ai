import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BASE_URL = "https://sports-ai-alpha.vercel.app";

type Game = { date?: string; away?: string; home?: string; league?: string };

function escapeXml(value: string) {
  return value.replace(/[<>&'\"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[char] || char);
}

function todayKorea() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function slug(value: string) {
  return encodeURIComponent(value.trim().replace(/\s+/g, "-"));
}

async function loadLeague(league: "kbo" | "mlb" | "npb", date: string): Promise<Game[]> {
  try {
    const response = await fetch(`${BASE_URL}/api/${league}?date=${encodeURIComponent(date)}`, { cache: "no-store" });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data?.games) ? data.games.map((game: Game) => ({ ...game, league: league.toUpperCase() })) : [];
  } catch {
    return [];
  }
}

export async function GET() {
  const date = todayKorea();
  const lists = await Promise.all([loadLeague("kbo", date), loadLeague("mlb", date), loadLeague("npb", date)]);
  const games = lists.flat();

  const items = games.map((game) => {
    const away = game.away || "원정팀";
    const home = game.home || "홈팀";
    const league = (game.league || "KBO").toLowerCase();
    const link = `${BASE_URL}/analysis/${league}/${date}/${slug(away)}-vs-${slug(home)}`;
    const title = `${away} vs ${home} ${game.league || ""} AI 분석`;
    const description = `${date} ${away} vs ${home} 선발투수, 최근 기록, 맞대결과 AI 승부예측.`;
    return `<item><title>${escapeXml(title)}</title><link>${escapeXml(link)}</link><guid isPermaLink="true">${escapeXml(link)}</guid><description>${escapeXml(description)}</description><pubDate>${new Date().toUTCString()}</pubDate></item>`;
  }).join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Sports AI 경기 분석</title><link>${BASE_URL}/analysis</link><description>KBO, MLB, NPB 오늘의 AI 야구 분석</description><language>ko-KR</language><lastBuildDate>${new Date().toUTCString()}</lastBuildDate>${items}</channel></rss>`;

  return new NextResponse(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, s-maxage=900, stale-while-revalidate=3600" } });
}

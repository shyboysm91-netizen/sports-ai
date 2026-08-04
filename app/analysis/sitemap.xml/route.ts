import { NextResponse } from "next/server";
import { matchupSlug, type AnalysisLeague } from "../../lib/analysis-slug";

export const dynamic = "force-dynamic";
export const revalidate = 900;

const BASE_URL = "https://장군분석.kr";
type Game = { date: string; away: string; home: string };
type UnknownObject = Record<string, unknown>;

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}
function first(obj: UnknownObject, keys: string[]) {
  for (const key of keys) { const value = text(obj[key]); if (value) return value; }
  return "";
}
function collectObjects(value: unknown, result: UnknownObject[] = []) {
  if (Array.isArray(value)) value.forEach((item) => collectObjects(item, result));
  else if (value && typeof value === "object") {
    const obj = value as UnknownObject; result.push(obj);
    Object.values(obj).forEach((item) => collectObjects(item, result));
  }
  return result;
}
function koreaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function normalizeDate(raw: string) { return raw.match(/\d{4}-\d{2}-\d{2}/)?.[0] || koreaToday(); }
function parseGames(payload: unknown): Game[] {
  const games = new Map<string, Game>();
  for (const obj of collectObjects(payload)) {
    const away = first(obj, ["away", "awayTeam", "awayName", "awayTeamName", "visitor", "visitorName"]);
    const home = first(obj, ["home", "homeTeam", "homeName", "homeTeamName"]);
    const date = normalizeDate(first(obj, ["date", "gameDate", "startDate", "scheduleDate"]));
    if (!away || !home || away === home || away.length > 60 || home.length > 60) continue;
    games.set(`${date}|${away}|${home}`, { date, away, home });
  }
  return [...games.values()].slice(0, 100);
}
function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
async function loadLeague(league: AnalysisLeague): Promise<Game[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(`${BASE_URL}/api/${league}`, { next: { revalidate: 900 }, headers: { Accept: "application/json" }, signal: controller.signal });
    if (!response.ok) return [];
    return parseGames(await response.json());
  } catch { return []; }
  finally { clearTimeout(timeout); }
}
function buildXml() {
  return Promise.all((["kbo", "mlb", "npb"] as AnalysisLeague[]).map(async (league) => ({ league, games: await loadLeague(league) }))).then((loaded) => {
    const now = new Date().toISOString();
    const urls = [`${BASE_URL}/analysis`, ...loaded.flatMap(({ league, games }) => games.map((g) => `${BASE_URL}/analysis/${league}/${g.date}/${matchupSlug(league, g.away, g.home)}`))];
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url, i) => `  <url>\n    <loc>${escapeXml(url)}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${i === 0 ? "hourly" : "daily"}</changefreq>\n    <priority>${i === 0 ? "0.9" : "0.8"}</priority>\n  </url>`).join("\n")}\n</urlset>`;
  });
}
const headers = { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=900, stale-while-revalidate=86400", "X-Content-Type-Options": "nosniff" } as const;
export async function GET() { return new NextResponse(await buildXml(), { status: 200, headers }); }
export function HEAD() { return new NextResponse(null, { status: 200, headers }); }

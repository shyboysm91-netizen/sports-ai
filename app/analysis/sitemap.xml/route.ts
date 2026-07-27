import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BASE_URL = "https://sports-ai-alpha.vercel.app";

type League = "kbo" | "mlb" | "npb";
type Game = {
  date: string;
  away: string;
  home: string;
};

type UnknownObject = Record<string, unknown>;

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function first(obj: UnknownObject, keys: string[]) {
  for (const key of keys) {
    const value = text(obj[key]);
    if (value) return value;
  }
  return "";
}

function collectObjects(value: unknown, result: UnknownObject[] = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectObjects(item, result));
  } else if (value && typeof value === "object") {
    const obj = value as UnknownObject;
    result.push(obj);
    Object.values(obj).forEach((item) => collectObjects(item, result));
  }
  return result;
}

function koreaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function normalizeDate(raw: string) {
  return raw.match(/\d{4}-\d{2}-\d{2}/)?.[0] || koreaToday();
}

function parseGames(payload: unknown): Game[] {
  const games = new Map<string, Game>();

  for (const obj of collectObjects(payload)) {
    const away = first(obj, [
      "away",
      "awayTeam",
      "awayName",
      "awayTeamName",
      "visitor",
      "visitorName",
    ]);
    const home = first(obj, ["home", "homeTeam", "homeName", "homeTeamName"]);
    const date = normalizeDate(
      first(obj, ["date", "gameDate", "startDate", "scheduleDate"]),
    );

    if (!away || !home || away === home) continue;
    if (away.length > 50 || home.length > 50) continue;

    games.set(`${date}|${away}|${home}`, { date, away, home });
  }

  return [...games.values()].slice(0, 100);
}

function slug(away: string, home: string) {
  return `${encodeURIComponent(away)}-vs-${encodeURIComponent(home)}`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function loadLeague(league: League): Promise<Game[]> {
  try {
    const response = await fetch(`${BASE_URL}/api/${league}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return [];
    return parseGames(await response.json());
  } catch {
    return [];
  }
}

export async function GET() {
  const leagues: League[] = ["kbo", "mlb", "npb"];
  const loaded = await Promise.all(
    leagues.map(async (league) => ({ league, games: await loadLeague(league) })),
  );

  const now = new Date().toISOString();
  const urls = [
    `${BASE_URL}/analysis`,
    ...loaded.flatMap(({ league, games }) =>
      games.map(
        (game) =>
          `${BASE_URL}/analysis/${league}/${encodeURIComponent(game.date)}/${slug(
            game.away,
            game.home,
          )}`,
      ),
    ),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map(
      (url, index) => `  <url>\n    <loc>${escapeXml(url)}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${index === 0 ? "hourly" : "daily"}</changefreq>\n    <priority>${index === 0 ? "0.9" : "0.8"}</priority>\n  </url>`,
    )
    .join("\n")}\n</urlset>`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
    },
  });
}

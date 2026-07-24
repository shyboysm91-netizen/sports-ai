import type { MetadataRoute } from "next";
import { GET as getKboGames } from "./api/kbo/route";
import { GET as getMlbGames } from "./api/mlb/route";
import { GET as getNpbGames } from "./api/npb/route";

const BASE_URL = "https://sports-ai-alpha.vercel.app";

export const revalidate = 300;
export const dynamic = "force-dynamic";

type League = "KBO" | "MLB" | "NPB";

type BaseballGame = {
  date?: string;
  away?: string;
  home?: string;
};

type RouteHandler = (request: Request) => Promise<Response> | Response;

function koreaDate(offsetDays = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function teamSlug(value: string) {
  return encodeURIComponent(value.trim().replace(/\s+/g, "-"));
}

function analysisUrl(league: League, game: BaseballGame, fallbackDate: string) {
  const date = game.date || fallbackDate;
  return `${BASE_URL}/analysis/${league.toLowerCase()}/${date}/${teamSlug(
    game.away || "원정팀",
  )}-vs-${teamSlug(game.home || "홈팀")}`;
}

/**
 * 배포된 자기 자신의 /api 주소를 fetch하면 sitemap 생성 시점에 빈 결과가
 * 반환될 수 있습니다. 각 API Route의 GET 함수를 서버에서 직접 실행하여
 * 실제 경기 목록을 안정적으로 가져옵니다.
 */
async function loadGames(
  handler: RouteHandler,
  endpoint: string,
  date: string,
): Promise<BaseballGame[]> {
  try {
    const request = new Request(
      `${BASE_URL}${endpoint}?date=${encodeURIComponent(date)}`,
      { headers: { Accept: "application/json" } },
    );
    const response = await handler(request);
    if (!response.ok) return [];

    const data = (await response.json()) as { games?: unknown };
    return Array.isArray(data.games) ? (data.games as BaseballGame[]) : [];
  } catch (error) {
    console.error(`[sitemap] ${endpoint} ${date} 경기 로드 실패`, error);
    return [];
  }
}

async function scheduledGameEntries(): Promise<MetadataRoute.Sitemap> {
  const leagues: Array<{
    league: League;
    endpoint: string;
    handler: RouteHandler;
  }> = [
    { league: "KBO", endpoint: "/api/kbo", handler: getKboGames },
    { league: "MLB", endpoint: "/api/mlb", handler: getMlbGames },
    { league: "NPB", endpoint: "/api/npb", handler: getNpbGames },
  ];

  const requests = [-1, 0, 1].flatMap((offset) => {
    const date = koreaDate(offset);

    return leagues.map(async ({ league, endpoint, handler }) => {
      const games = await loadGames(handler, endpoint, date);

      return games
        .filter((game) => Boolean(game.away && game.home))
        .map((game) => ({
          url: analysisUrl(league, game, date),
          lastModified: new Date(),
          changeFrequency: "daily" as const,
          priority: offset === 0 ? 0.9 : 0.8,
        }));
    });
  });

  const groups = await Promise.all(requests);
  const unique = new Map<string, MetadataRoute.Sitemap[number]>();
  for (const entry of groups.flat()) unique.set(entry.url, entry);
  return [...unique.values()];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/game`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/mlb-game`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/npb-game`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${BASE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${BASE_URL}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
  ];

  return [...staticEntries, ...(await scheduledGameEntries())];
}

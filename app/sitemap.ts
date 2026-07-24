import type { MetadataRoute } from "next";

const BASE_URL = "https://sports-ai-alpha.vercel.app";

export const revalidate = 300;
export const dynamic = "force-dynamic";

type League = "KBO" | "MLB" | "NPB";

type BaseballGame = {
  date?: string;
  away?: string;
  home?: string;
};

function koreaDate(offsetDays = 0) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const base = new Date();
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return formatter.format(base);
}

function cleanTeamSlug(value: string) {
  return encodeURIComponent(value.trim());
}

function analysisUrl(league: League, game: BaseballGame, fallbackDate: string) {
  const date = game.date || fallbackDate;
  const away = cleanTeamSlug(game.away || "원정팀");
  const home = cleanTeamSlug(game.home || "홈팀");

  // sitemap URL에는 쿼리스트링을 넣지 않습니다.
  // XML의 & 문자 오류를 막고 canonical 주소와 동일하게 유지합니다.
  return `${BASE_URL}/analysis/${league.toLowerCase()}/${date}/${away}-vs-${home}`;
}

async function loadGames(endpoint: string, date: string): Promise<BaseballGame[]> {
  try {
    const response = await fetch(
      `${BASE_URL}${endpoint}?date=${encodeURIComponent(date)}`,
      {
        next: { revalidate: 300 },
        headers: { Accept: "application/json" },
      },
    );

    if (!response.ok) return [];

    const data = (await response.json()) as { games?: unknown };
    return Array.isArray(data.games) ? (data.games as BaseballGame[]) : [];
  } catch {
    return [];
  }
}

async function scheduledGameEntries(): Promise<MetadataRoute.Sitemap> {
  const leagueEndpoints: Array<{ league: League; endpoint: string }> = [
    { league: "KBO", endpoint: "/api/kbo" },
    { league: "MLB", endpoint: "/api/mlb" },
    { league: "NPB", endpoint: "/api/npb" },
  ];

  const requests = [-1, 0, 1].flatMap((offset) => {
    const date = koreaDate(offset);

    return leagueEndpoints.map(async ({ league, endpoint }) => {
      const games = await loadGames(endpoint, date);

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

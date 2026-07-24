import type { MetadataRoute } from "next";

const BASE_URL = "https://sports-ai-alpha.vercel.app";

type League = "KBO" | "MLB" | "NPB";

type BaseballGame = {
  date?: string;
  away?: string;
  home?: string;
};

function koreaDate(offsetDays = 0) {
  const now = new Date();
  const korea = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  korea.setUTCDate(korea.getUTCDate() + offsetDays);
  return korea.toISOString().slice(0, 10);
}

function gameUrl(league: League, game: BaseballGame) {
  const date = game.date || koreaDate();
  const away = game.away || "원정팀";
  const home = game.home || "홈팀";
  const matchup = `${encodeURIComponent(away)}-vs-${encodeURIComponent(home)}`;

  // sitemap URL에는 쿼리스트링을 넣지 않습니다.
  // '&' 문자가 XML EntityRef 오류를 일으키는 문제를 방지합니다.
  return `${BASE_URL}/analysis/${league.toLowerCase()}/${date}/${matchup}`;
}

async function scheduledGameEntries(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  const seen = new Set<string>();
  const leagues: Array<{ league: League; endpoint: string }> = [
    { league: "KBO", endpoint: "/api/kbo" },
    { league: "MLB", endpoint: "/api/mlb" },
    { league: "NPB", endpoint: "/api/npb" },
  ];

  await Promise.all(
    [-1, 0, 1].flatMap((offset) => {
      const date = koreaDate(offset);
      return leagues.map(async ({ league, endpoint }) => {
        try {
          const response = await fetch(
            `${BASE_URL}${endpoint}?date=${encodeURIComponent(date)}`,
            { next: { revalidate: 300 } },
          );
          if (!response.ok) return;

          const data = await response.json();
          const games: BaseballGame[] = Array.isArray(data?.games) ? data.games : [];

          for (const game of games) {
            if (!game.away || !game.home) continue;
            const url = gameUrl(league, { ...game, date: game.date || date });
            if (seen.has(url)) continue;
            seen.add(url);

            entries.push({
              url,
              lastModified: new Date(),
              changeFrequency: "daily",
              priority: offset === 0 ? 0.9 : 0.8,
            });
          }
        } catch {
          // 일정 API가 일시적으로 실패해도 기본 sitemap은 계속 제공합니다.
        }
      });
    }),
  );

  return entries;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/game`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE_URL}/mlb-game`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE_URL}/npb-game`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE_URL}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${BASE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${BASE_URL}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
  ];

  return [...staticEntries, ...(await scheduledGameEntries())];
}

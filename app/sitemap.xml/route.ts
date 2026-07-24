import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const BASE_URL = "https://sports-ai-alpha.vercel.app";

type League = "kbo" | "mlb" | "npb";
type Game = {
  date?: string;
  away?: string;
  home?: string;
};

type SitemapItem = {
  url: string;
  lastModified: string;
  changeFrequency: "daily" | "monthly" | "yearly";
  priority: number;
};

function koreaDate(offsetDays = 0) {
  const now = new Date();
  const shifted = new Date(now.getTime() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(shifted);
}

function slug(value: string) {
  return encodeURIComponent(value.trim().replace(/\s+/g, "-"));
}

function xmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function loadGames(origin: string, league: League, date: string): Promise<Game[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(`${origin}/api/${league}?date=${encodeURIComponent(date)}`, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "Sports-AI-Sitemap/1.0",
      },
      signal: controller.signal,
    });

    if (!response.ok) return [];
    const data = (await response.json()) as { games?: unknown };
    return Array.isArray(data.games) ? (data.games as Game[]) : [];
  } catch (error) {
    console.error(`[sitemap.xml] ${league} ${date} load failed`, error);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function staticItems(now: string): SitemapItem[] {
  return [
    { url: BASE_URL, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/game`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/mlb-game`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/npb-game`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${BASE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${BASE_URL}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
  ];
}

function toXml(items: SitemapItem[]) {
  const body = items
    .map(
      (item) => `  <url>\n    <loc>${xmlEscape(item.url)}</loc>\n    <lastmod>${item.lastModified}</lastmod>\n    <changefreq>${item.changeFrequency}</changefreq>\n    <priority>${item.priority.toFixed(1)}</priority>\n  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const now = new Date().toISOString();
  const leagues: League[] = ["kbo", "mlb", "npb"];
  const dates = [-1, 0, 1].map(koreaDate);

  const groups = await Promise.all(
    leagues.flatMap((league) =>
      dates.map(async (date) => {
        const games = await loadGames(origin, league, date);
        return games
          .filter((game) => Boolean(game.away && game.home))
          .map<SitemapItem>((game) => ({
            url: `${BASE_URL}/analysis/${league}/${game.date || date}/${slug(game.away!)}` +
              `-vs-${slug(game.home!)}`,
            lastModified: now,
            changeFrequency: "daily",
            priority: date === koreaDate(0) ? 0.9 : 0.8,
          }));
      }),
    ),
  );

  const unique = new Map<string, SitemapItem>();
  for (const item of [...staticItems(now), ...groups.flat()]) {
    unique.set(item.url, item);
  }

  return new NextResponse(toXml([...unique.values()]), {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}

import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BASE_URL = "https://sports-ai-alpha.vercel.app";

type League = "kbo" | "mlb" | "npb";
type Game = {
  date: string;
  away: string;
  home: string;
  time?: string;
};

type UnknownObject = Record<string, unknown>;

export const metadata: Metadata = {
  title: "오늘의 KBO·MLB·NPB 야구 AI 경기 분석 | Sports AI",
  description:
    "오늘 열리는 KBO, MLB, NPB 경기의 선발투수, 최근 전적, 맞대결, AI 승리 확률과 예상 스코어를 한눈에 확인하세요.",
  alternates: { canonical: `${BASE_URL}/analysis` },
  openGraph: {
    title: "오늘의 야구 AI 경기 분석 | Sports AI",
    description:
      "KBO·MLB·NPB 오늘 경기의 선발, 최근 전적, 맞대결과 AI 승부예측을 확인하세요.",
    url: `${BASE_URL}/analysis`,
    siteName: "Sports AI",
    type: "website",
    locale: "ko_KR",
  },
};

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
    const date = first(obj, ["date", "gameDate", "startDate", "scheduleDate"]);
    const time = first(obj, ["time", "gameTime", "startTime"]);

    if (!away || !home || away === home) continue;
    if (away.length > 50 || home.length > 50) continue;

    const normalizedDate = date.match(/\d{4}-\d{2}-\d{2}/)?.[0] || date || koreaToday();
    const key = `${normalizedDate}|${away}|${home}`;
    games.set(key, { date: normalizedDate, away, home, time });
  }

  return [...games.values()].slice(0, 30);
}

function koreaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function matchupSlug(away: string, home: string) {
  return `${encodeURIComponent(away)}-vs-${encodeURIComponent(home)}`;
}

function analysisHref(league: League, game: Game) {
  const query = new URLSearchParams({
    league: league.toUpperCase(),
    date: game.date,
    away: game.away,
    home: game.home,
  });
  return `/analysis/${league}/${encodeURIComponent(game.date)}/${matchupSlug(
    game.away,
    game.home,
  )}?${query.toString()}`;
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

const LEAGUES: Array<{ key: League; label: string }> = [
  { key: "kbo", label: "KBO" },
  { key: "mlb", label: "MLB" },
  { key: "npb", label: "NPB" },
];

export default async function AnalysisIndexPage() {
  const loaded = await Promise.all(
    LEAGUES.map(async (league) => ({
      ...league,
      games: await loadLeague(league.key),
    })),
  );

  const itemList = loaded.flatMap((league) =>
    league.games.map((game, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: `${game.away} vs ${game.home} ${league.label} AI 분석`,
      url: `${BASE_URL}${analysisHref(league.key, game)}`,
    })),
  );

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "오늘의 야구 AI 경기 분석",
    url: `${BASE_URL}/analysis`,
    itemListElement: itemList,
  };

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "28px 16px 48px" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <h1 style={{ marginBottom: 8 }}>오늘의 야구 AI 경기 분석</h1>
      <p style={{ marginTop: 0, color: "#555", lineHeight: 1.65 }}>
        KBO·MLB·NPB 경기별 선발투수, 최근 전적, 맞대결과 AI 승부예측을
        확인하세요.
      </p>

      {loaded.map((league) => (
        <section key={league.key} style={{ marginTop: 32 }}>
          <h2 style={{ marginBottom: 12 }}>{league.label} 경기 분석</h2>
          {league.games.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {league.games.map((game) => (
                <Link
                  key={`${league.key}-${game.date}-${game.away}-${game.home}`}
                  href={analysisHref(league.key, game)}
                  style={{
                    display: "block",
                    padding: "14px 16px",
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    color: "inherit",
                    textDecoration: "none",
                    background: "#fff",
                  }}
                >
                  <strong>
                    {game.away} vs {game.home}
                  </strong>
                  <div style={{ marginTop: 5, color: "#666", fontSize: 14 }}>
                    {game.date}
                    {game.time ? ` · ${game.time}` : ""} · AI 경기 분석 보기
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p style={{ color: "#777" }}>현재 불러온 경기 일정이 없습니다.</p>
          )}
        </section>
      ))}
    </main>
  );
}

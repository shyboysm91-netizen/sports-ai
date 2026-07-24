import type { Metadata } from "next";
import { redirect } from "next/navigation";
import KboGameClient from "../../../../game/GameClient";
import MlbGameClient from "../../../../mlb-game/GameClient";
import NpbGameClient from "../../../../npb-game/GameClient";

const BASE_URL = "https://sports-ai-alpha.vercel.app";

type RouteParams = Promise<{
  league: string;
  date: string;
  matchup: string;
}>;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type League = "kbo" | "mlb" | "npb";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseMatchup(matchup: string) {
  const decoded = safeDecode(matchup);
  const separator = "-vs-";
  const index = decoded.indexOf(separator);

  if (index < 0) {
    return { away: "원정팀", home: "홈팀" };
  }

  return {
    away: decoded.slice(0, index).trim() || "원정팀",
    home: decoded.slice(index + separator.length).trim() || "홈팀",
  };
}

function normalizeLeague(value: string): League {
  const league = value.toLowerCase();
  return league === "mlb" || league === "npb" ? league : "kbo";
}

function leagueLabel(league: League) {
  return league.toUpperCase();
}

function cleanCanonical(league: League, date: string, matchup: string) {
  return `${BASE_URL}/analysis/${league}/${encodeURIComponent(date)}/${matchup}`;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: RouteParams;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const route = await params;
  const query = await searchParams;
  const league = normalizeLeague(route.league);
  const parsed = parseMatchup(route.matchup);
  const away = first(query.away) || parsed.away;
  const home = first(query.home) || parsed.home;
  const date = first(query.date) || route.date;
  const label = leagueLabel(league);
  const title = `${away} vs ${home} ${label} AI 분석 및 승부예측`;
  const description = `${date} ${away} vs ${home} 경기의 선발투수, 최근 10경기, 맞대결, 팀 전력과 AI 승리 확률 및 예상 결과를 확인하세요.`;
  const canonical = cleanCanonical(league, route.date, route.matchup);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Sports AI",
      type: "article",
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function AnalysisGamePage({
  params,
  searchParams,
}: {
  params: RouteParams;
  searchParams: SearchParams;
}) {
  const route = await params;
  const query = await searchParams;
  const league = normalizeLeague(route.league);
  const parsed = parseMatchup(route.matchup);
  const away = first(query.away) || parsed.away;
  const home = first(query.home) || parsed.home;
  const date = first(query.date) || route.date;

  // 검색 결과의 깨끗한 URL로 직접 들어온 경우에도 기존 분석 화면이
  // 필요한 기본 검색값을 받을 수 있도록 한 번만 보완합니다.
  if (!first(query.away) || !first(query.home) || !first(query.date)) {
    const nextQuery = new URLSearchParams();
    for (const [key, raw] of Object.entries(query)) {
      const value = first(raw);
      if (value) nextQuery.set(key, value);
    }
    nextQuery.set("league", leagueLabel(league));
    nextQuery.set("date", date);
    nextQuery.set("away", away);
    nextQuery.set("home", home);

    redirect(
      `/analysis/${league}/${encodeURIComponent(route.date)}/${route.matchup}?${nextQuery.toString()}`,
    );
  }

  const canonical = cleanCanonical(league, route.date, route.matchup);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${away} vs ${home}`,
    startDate: date,
    url: canonical,
    sport: "Baseball",
    eventStatus: "https://schema.org/EventScheduled",
    homeTeam: { "@type": "SportsTeam", name: home },
    awayTeam: { "@type": "SportsTeam", name: away },
    organizer: {
      "@type": "Organization",
      name: "Sports AI",
      url: BASE_URL,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      {league === "mlb" ? (
        <MlbGameClient />
      ) : league === "npb" ? (
        <NpbGameClient />
      ) : (
        <KboGameClient />
      )}
    </>
  );
}

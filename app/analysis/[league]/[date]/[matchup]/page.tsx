import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import KboGameClient from "../../../../game/GameClient";
import MlbGameClient from "../../../../mlb-game/GameClient";
import NpbGameClient from "../../../../npb-game/GameClient";
import { matchupSlug, teamNameFromSlug } from "../../../../lib/analysis-slug";

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


function normalizeTeamName(league: League, value: string) {
  return teamNameFromSlug(league, safeDecode(value));
}

function leagueLabel(league: League) {
  return league.toUpperCase();
}

function cleanCanonical(league: League, date: string, away: string, home: string) {
  return `${BASE_URL}/analysis/${league}/${encodeURIComponent(date)}/${matchupSlug(league, away, home)}`;
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
  const away = normalizeTeamName(league, first(query.away) || parsed.away);
  const home = normalizeTeamName(league, first(query.home) || parsed.home);
  const date = first(query.date) || route.date;
  const label = leagueLabel(league);
  const title = `${away} vs ${home} ${label} AI 분석 및 승부예측`;
  const description = `${date} ${away} vs ${home} 경기의 선발투수, 최근 10경기, 맞대결, 팀 전력과 AI 승리 확률 및 예상 결과를 확인하세요.`;
  const canonical = cleanCanonical(league, route.date, away, home);

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
      images: [{ url: `${canonical}/opengraph-image`, width: 1200, height: 630, alt: `${away} vs ${home} 경기 분석` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${canonical}/opengraph-image`],
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
  const away = normalizeTeamName(league, first(query.away) || parsed.away);
  const home = normalizeTeamName(league, first(query.home) || parsed.home);
  const date = first(query.date) || route.date;

  // 검색 결과의 깨끗한 URL로 직접 들어온 경우에도 기존 분석 화면이
  // 필요한 기본 검색값을 받을 수 있도록 한 번만 보완합니다.
  if (league !== "kbo" && (!first(query.away) || !first(query.home) || !first(query.date))) {
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

  const canonical = cleanCanonical(league, route.date, away, home);
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SportsEvent",
        "@id": `${canonical}#event`,
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
      },
      {
        "@type": "WebPage",
        "@id": `${canonical}#webpage`,
        url: canonical,
        name: `${away} vs ${home} ${leagueLabel(league)} AI 분석 및 승부예측`,
        description: `${date} ${away} vs ${home} 경기의 선발투수, 최근 10경기, 맞대결, 팀 전력과 AI 승리 확률 및 예상 결과를 제공합니다.`,
        inLanguage: "ko-KR",
        isPartOf: {
          "@type": "WebSite",
          "@id": `${BASE_URL}/#website`,
          name: "Sports AI",
          url: BASE_URL,
        },
        about: { "@id": `${canonical}#event` },
      },
      {
        "@type": "FAQPage",
        "@id": `${canonical}#faq`,
        mainEntity: [
          {
            "@type": "Question",
            name: `${away} vs ${home} 경기 분석에서 무엇을 확인할 수 있나요?`,
            acceptedAnswer: {
              "@type": "Answer",
              text: "선발투수 비교, 최근 경기 흐름, 맞대결, 팀 전력, 예상 스코어와 AI 승리 확률을 확인할 수 있습니다.",
            },
          },
          {
            "@type": "Question",
            name: `${away} vs ${home} 예상 결과는 어떻게 계산하나요?`,
            acceptedAnswer: {
              "@type": "Answer",
              text: "Sports AI는 공개된 경기 기록과 선발투수, 타격, 불펜, 최근 흐름 등의 데이터를 종합해 예상 결과를 제공합니다.",
            },
          },
          {
            "@type": "Question",
            name: "AI 승부예측은 확정 결과인가요?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "아닙니다. AI 분석은 참고용 예상이며 실제 경기 결과를 보장하지 않습니다.",
            },
          },
        ],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Sports AI",
            item: BASE_URL,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: `${leagueLabel(league)} 경기 분석`,
            item:
              league === "mlb"
                ? `${BASE_URL}/mlb-game`
                : league === "npb"
                  ? `${BASE_URL}/npb-game`
                  : `${BASE_URL}/game`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: `${away} vs ${home}`,
            item: canonical,
          },
        ],
      },
    ],
  };

  const leaguePage =
    league === "mlb" ? "/mlb-game" : league === "npb" ? "/npb-game" : "/game";

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

      <nav
        aria-label="관련 분석"
        style={{ maxWidth: 1120, margin: "0 auto", padding: "16px 16px 40px" }}
      >
        <Link href="/analysis">오늘의 모든 경기 분석 보기</Link>
        <span aria-hidden="true"> · </span>
        <Link href={leaguePage}>{leagueLabel(league)} 전체 경기 보기</Link>
      </nav>
    </>
  );
}

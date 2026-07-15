import { NextResponse } from "next/server";

type TeamBatting = {
  teamCode: string;
  team: string;
  games: number;
  plateAppearances: number;
  atBats: number;
  runs: number;
  hits: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  totalBases: number;
  rbi: number;
  walks: number;
  strikeouts: number;
  battingAverage: number;
  onBasePercentage: number;
  sluggingPercentage: number;
  ops: number;
  scoringPositionAverage: number;
  averageRunsPerGame: number;
};

const TEAM_NAMES: Record<string, string> = {
  KIA: "KIA 타이거즈",
  SAMSUNG: "삼성 라이온즈",
  LG: "LG 트윈스",
  DOOSAN: "두산 베어스",
  KT: "KT 위즈",
  SSG: "SSG 랜더스",
  LOTTE: "롯데 자이언츠",
  HANWHA: "한화 이글스",
  NC: "NC 다이노스",
  KIWOOM: "키움 히어로즈",
};

function cleanHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value: string | undefined) {
  if (!value) {
    return 0;
  }

  const parsed = Number(value.replace(/,/g, ""));

  return Number.isFinite(parsed) ? parsed : 0;
}

function getCells(rowHtml: string) {
  const cellMatches =
    rowHtml.match(/<td\b[^>]*>[\s\S]*?<\/td>/gi) ?? [];

  return cellMatches.map(cleanHtml).filter(Boolean);
}

export async function GET() {
  try {
    const response = await fetch(
      "https://eng.koreabaseball.com/stats/TeamStats.aspx",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "text/html",
        },
        next: {
          revalidate: 1800,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`KBO 팀 타격 기록 요청 실패: ${response.status}`);
    }

    const html = await response.text();

    const rowMatches =
      html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [];

    const firstPage = new Map<
      string,
      {
        games: number;
        plateAppearances: number;
        atBats: number;
        runs: number;
        hits: number;
        doubles: number;
        triples: number;
        homeRuns: number;
        totalBases: number;
        rbi: number;
        battingAverage: number;
      }
    >();

    const secondPage = new Map<
      string,
      {
        walks: number;
        strikeouts: number;
        sluggingPercentage: number;
        onBasePercentage: number;
        ops: number;
        scoringPositionAverage: number;
      }
    >();

    for (const rowHtml of rowMatches) {
      const cells = getCells(rowHtml);

      if (cells.length === 0) {
        continue;
      }

      const teamCode = cells[0]?.toUpperCase();

      if (!TEAM_NAMES[teamCode]) {
        continue;
      }

      /*
        첫 번째 타격 표

        TEAM AVG G PA AB R H 2B 3B HR TB RBI SB CS SAC SF
      */
      if (
        cells.length >= 16 &&
        /^0?\.\d{3}$/.test(cells[1] ?? "") &&
        !firstPage.has(teamCode)
      ) {
        firstPage.set(teamCode, {
          battingAverage: parseNumber(cells[1]),
          games: parseNumber(cells[2]),
          plateAppearances: parseNumber(cells[3]),
          atBats: parseNumber(cells[4]),
          runs: parseNumber(cells[5]),
          hits: parseNumber(cells[6]),
          doubles: parseNumber(cells[7]),
          triples: parseNumber(cells[8]),
          homeRuns: parseNumber(cells[9]),
          totalBases: parseNumber(cells[10]),
          rbi: parseNumber(cells[11]),
        });

        continue;
      }

      /*
        두 번째 타격 표

        TEAM BB IBB HBP SO GIDP SLG OBP E SBPCT
        BB/K XBH/H MH OPS RISP PH
      */
      if (
        cells.length >= 16 &&
        /^\d+$/.test(cells[1] ?? "") &&
        /^0?\.\d{3}$/.test(cells[6] ?? "") &&
        /^0?\.\d{3}$/.test(cells[7] ?? "") &&
        /^0?\.\d{3}$/.test(cells[13] ?? "")
      ) {
        secondPage.set(teamCode, {
          walks: parseNumber(cells[1]),
          strikeouts: parseNumber(cells[4]),
          sluggingPercentage: parseNumber(cells[6]),
          onBasePercentage: parseNumber(cells[7]),
          ops: parseNumber(cells[13]),
          scoringPositionAverage: parseNumber(cells[14]),
        });
      }
    }

    const batting: TeamBatting[] = [];

    for (const teamCode of Object.keys(TEAM_NAMES)) {
      const pageOne = firstPage.get(teamCode);
      const pageTwo = secondPage.get(teamCode);

      if (!pageOne) {
        continue;
      }

      batting.push({
        teamCode,
        team: TEAM_NAMES[teamCode],
        games: pageOne.games,
        plateAppearances: pageOne.plateAppearances,
        atBats: pageOne.atBats,
        runs: pageOne.runs,
        hits: pageOne.hits,
        doubles: pageOne.doubles,
        triples: pageOne.triples,
        homeRuns: pageOne.homeRuns,
        totalBases: pageOne.totalBases,
        rbi: pageOne.rbi,
        walks: pageTwo?.walks ?? 0,
        strikeouts: pageTwo?.strikeouts ?? 0,
        battingAverage: pageOne.battingAverage,
        onBasePercentage: pageTwo?.onBasePercentage ?? 0,
        sluggingPercentage: pageTwo?.sluggingPercentage ?? 0,
        ops: pageTwo?.ops ?? 0,
        scoringPositionAverage:
          pageTwo?.scoringPositionAverage ?? 0,
        averageRunsPerGame:
          pageOne.games > 0
            ? Number((pageOne.runs / pageOne.games).toFixed(2))
            : 0,
      });
    }

    batting.sort(
      (a, b) => b.battingAverage - a.battingAverage,
    );

    if (batting.length === 0) {
      throw new Error("KBO 팀 타격 기록을 분석하지 못했습니다.");
    }

    return NextResponse.json({
      success: true,
      source: "KBO official English team stats",
      updatedAt: new Date().toISOString(),
      count: batting.length,
      batting,
    });
  } catch (error) {
    console.error("KBO 팀 타격 기록 오류:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "KBO 팀 타격 기록을 불러오지 못했습니다.",
        batting: [],
      },
      {
        status: 500,
      },
    );
  }
}
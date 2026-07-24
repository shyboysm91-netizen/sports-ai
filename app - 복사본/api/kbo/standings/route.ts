import { NextResponse } from "next/server";

type KboStanding = {
  rank: number;
  teamCode: string;
  team: string;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  winningPercentage: number;
  gamesBehind: string;
  streak: string;
  home: string;
  away: string;
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

function parseNumber(value: string) {
  const number = Number(value.replace(/,/g, ""));

  return Number.isFinite(number) ? number : 0;
}

export async function GET() {
  try {
    const url =
      "https://eng.koreabaseball.com/Standings/TeamStandings.aspx";

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/html",
      },
      next: {
        revalidate: 1800,
      },
    });

    if (!response.ok) {
      throw new Error(`KBO 순위 요청 실패: ${response.status}`);
    }

    const html = await response.text();
    const rowMatches = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [];

    const standings: KboStanding[] = [];

    for (const rowHtml of rowMatches) {
      const cellMatches =
        rowHtml.match(/<td\b[^>]*>[\s\S]*?<\/td>/gi) ?? [];

      const cells = cellMatches.map(cleanHtml).filter(Boolean);

      if (cells.length < 10) {
        continue;
      }

      const rank = parseNumber(cells[0]);
      const teamCode = cells[1].toUpperCase();

      if (!TEAM_NAMES[teamCode]) {
        continue;
      }

      const games = parseNumber(cells[2]);
      const wins = parseNumber(cells[3]);
      const losses = parseNumber(cells[4]);
      const draws = parseNumber(cells[5]);
      const winningPercentage = parseNumber(cells[6]);

      standings.push({
        rank,
        teamCode,
        team: TEAM_NAMES[teamCode],
        games,
        wins,
        losses,
        draws,
        winningPercentage,
        gamesBehind: cells[7] ?? "-",
        streak: cells[8] ?? "-",
        home: cells[9] ?? "-",
        away: cells[10] ?? "-",
      });
    }

    standings.sort((a, b) => a.rank - b.rank);

    if (standings.length === 0) {
      throw new Error("KBO 팀 순위 표를 분석하지 못했습니다.");
    }

    return NextResponse.json({
      success: true,
      source: "KBO official English standings",
      updatedAt: new Date().toISOString(),
      count: standings.length,
      standings,
    });
  } catch (error) {
    console.error("KBO 팀 순위 오류:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "KBO 팀 순위를 불러오지 못했습니다.",
        standings: [],
      },
      {
        status: 500,
      },
    );
  }
}
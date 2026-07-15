import { NextResponse } from "next/server";

type TeamPitcher = {
  pcode: string;
  player: string;
  teamCode: string;
  team: string;
  era: number;
  games: number;
  completeGames: number;
  shutouts: number;
  wins: number;
  losses: number;
  saves: number;
  holds: number;
  winningPercentage: number;
  plateAppearances: number;
  pitches: number;
  innings: string;
  inningsValue: number;
  hits: number;
  doubles: number;
  triples: number;
  homeRuns: number;
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
  if (!value || value === "-") {
    return 0;
  }

  const number = Number(value.replace(/,/g, ""));

  return Number.isFinite(number) ? number : 0;
}

function parseInnings(value: string | undefined) {
  if (!value) {
    return 0;
  }

  const cleaned = value.trim();

  if (cleaned.includes(" ")) {
    const [wholePart, fractionPart] = cleaned.split(/\s+/);
    const whole = Number(wholePart) || 0;

    if (fractionPart === "1/3") {
      return whole + 1 / 3;
    }

    if (fractionPart === "2/3") {
      return whole + 2 / 3;
    }

    return whole;
  }

  if (cleaned === "1/3") {
    return 1 / 3;
  }

  if (cleaned === "2/3") {
    return 2 / 3;
  }

  return Number(cleaned) || 0;
}

function getCellHtml(rowHtml: string) {
  return rowHtml.match(/<td\b[^>]*>[\s\S]*?<\/td>/gi) ?? [];
}

function getPcode(playerCellHtml: string) {
  const match = playerCellHtml.match(/[?&]pcode=(\d+)/i);

  return match?.[1] ?? "";
}

async function loadTeamPitchers(teamCode: string) {
  const url =
    `https://eng.koreabaseball.com/Stats/PitchingByTeams.aspx` +
    `?codeTeam=${encodeURIComponent(teamCode)}`;

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
    throw new Error(
      `${teamCode} 투수 기록 요청 실패: ${response.status}`,
    );
  }

  const html = await response.text();

  const rows =
    html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [];

  const pitchers: TeamPitcher[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const cellHtml = getCellHtml(row);
    const cells = cellHtml.map(cleanHtml).filter(Boolean);

    if (cells.length < 18) {
      continue;
    }

    const player = cells[0];
    const rowTeamCode = cells[1]?.toUpperCase();
    const eraText = cells[2];
    const pcode = getPcode(cellHtml[0] ?? "");

    if (
      !player ||
      !pcode ||
      player.toUpperCase() === "PLAYER" ||
      player.toUpperCase() === "TOTAL"
    ) {
      continue;
    }

    if (rowTeamCode !== teamCode) {
      continue;
    }

    if (!/^\d+(\.\d+)?$/.test(eraText ?? "")) {
      continue;
    }

    const key = `${teamCode}-${pcode}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    pitchers.push({
      pcode,
      player,
      teamCode,
      team: TEAM_NAMES[teamCode],
      era: parseNumber(cells[2]),
      games: parseNumber(cells[3]),
      completeGames: parseNumber(cells[4]),
      shutouts: parseNumber(cells[5]),
      wins: parseNumber(cells[6]),
      losses: parseNumber(cells[7]),
      saves: parseNumber(cells[8]),
      holds: parseNumber(cells[9]),
      winningPercentage: parseNumber(cells[10]),
      plateAppearances: parseNumber(cells[11]),
      pitches: parseNumber(cells[12]),
      innings: cells[13] ?? "0",
      inningsValue: parseInnings(cells[13]),
      hits: parseNumber(cells[14]),
      doubles: parseNumber(cells[15]),
      triples: parseNumber(cells[16]),
      homeRuns: parseNumber(cells[17]),
    });
  }

  pitchers.sort((a, b) => {
    if (b.inningsValue !== a.inningsValue) {
      return b.inningsValue - a.inningsValue;
    }

    return a.era - b.era;
  });

  return pitchers;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const requestedTeam =
      searchParams.get("team")?.toUpperCase() ?? "";

    const teamCodes = requestedTeam
      ? [requestedTeam]
      : Object.keys(TEAM_NAMES);

    for (const teamCode of teamCodes) {
      if (!TEAM_NAMES[teamCode]) {
        return NextResponse.json(
          {
            success: false,
            message: `지원하지 않는 팀 코드입니다: ${teamCode}`,
            pitchers: [],
          },
          { status: 400 },
        );
      }
    }

    const teamResults = await Promise.all(
      teamCodes.map(async (teamCode) => ({
        teamCode,
        team: TEAM_NAMES[teamCode],
        pitchers: await loadTeamPitchers(teamCode),
      })),
    );

    const pitchers = teamResults.flatMap(
      (result) => result.pitchers,
    );

    if (pitchers.length === 0) {
      throw new Error("KBO 투수 기록을 분석하지 못했습니다.");
    }

    return NextResponse.json({
      success: true,
      source: "KBO official English pitching stats",
      updatedAt: new Date().toISOString(),
      teamCount: teamResults.length,
      pitcherCount: pitchers.length,
      teams: teamResults,
      pitchers,
    });
  } catch (error) {
    console.error("KBO 투수 기록 오류:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "KBO 투수 기록을 불러오지 못했습니다.",
        teams: [],
        pitchers: [],
      },
      { status: 500 },
    );
  }
}
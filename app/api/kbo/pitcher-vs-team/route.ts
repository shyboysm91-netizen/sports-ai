import { NextResponse } from "next/server";

type OpponentPitchingStats = {
  opponent: string;
  games: number;
  era: number;
  wins: number;
  losses: number;
  saves: number;
  holds: number;
  winningPercentage: number;
  battersFaced: number;
  innings: string;
  inningsValue: number;
  hits: number;
  homeRuns: number;
  walks: number;
  hitByPitch: number;
  strikeouts: number;
  runs: number;
  earnedRuns: number;
  opponentAverage: number;
  whip: number;
};

const OPPONENT_NAMES: Record<string, string> = {
  KIA: "KIA",
  SAMSUNG: "삼성",
  LG: "LG",
  DOOSAN: "두산",
  KT: "KT",
  SSG: "SSG",
  LOTTE: "롯데",
  HANWHA: "한화",
  NC: "NC",
  KIWOOM: "키움",

  "KIA 타이거즈": "KIA",
  "삼성 라이온즈": "삼성",
  "LG 트윈스": "LG",
  "두산 베어스": "두산",
  "KT 위즈": "KT",
  "SSG 랜더스": "SSG",
  "롯데 자이언츠": "롯데",
  "한화 이글스": "한화",
  "NC 다이노스": "NC",
  "키움 히어로즈": "키움",
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

  const parsed = Number(value.replace(/,/g, ""));

  return Number.isFinite(parsed) ? parsed : 0;
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

function normalizeOpponent(value: string) {
  const decoded = decodeURIComponent(value).trim();

  return (
    OPPONENT_NAMES[decoded] ??
    OPPONENT_NAMES[decoded.toUpperCase()] ??
    decoded
  );
}

function getPlayerName(html: string) {
  const text = cleanHtml(html);

  const match = text.match(/선수명:\s*([가-힣A-Za-z·\-\s]+?)\s+등번호:/);

  return match?.[1]?.trim() ?? "선수명 확인 불가";
}

function findOpponentStats(
  html: string,
  targetOpponent: string,
): OpponentPitchingStats | null {
  const rows =
    html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [];

  for (const row of rows) {
    const cellMatches =
      row.match(/<td\b[^>]*>[\s\S]*?<\/td>/gi) ?? [];

    const cells = cellMatches.map(cleanHtml).filter(Boolean);

    /*
      상대팀별 기록 표

      상대팀
      G ERA W L SV HLD WPCT TBF IP
      H HR BB HBP SO R ER AVG
    */
    if (cells.length < 18) {
      continue;
    }

    const opponent = cells[0];

    if (opponent !== targetOpponent) {
      continue;
    }

    const innings = cells[9] ?? "0";
    const inningsValue = parseInnings(innings);
    const hits = parseNumber(cells[10]);
    const walks = parseNumber(cells[12]);

    const whip =
      inningsValue > 0
        ? Number(((hits + walks) / inningsValue).toFixed(2))
        : 0;

    return {
      opponent,
      games: parseNumber(cells[1]),
      era: parseNumber(cells[2]),
      wins: parseNumber(cells[3]),
      losses: parseNumber(cells[4]),
      saves: parseNumber(cells[5]),
      holds: parseNumber(cells[6]),
      winningPercentage: parseNumber(cells[7]),
      battersFaced: parseNumber(cells[8]),
      innings,
      inningsValue,
      hits,
      homeRuns: parseNumber(cells[11]),
      walks,
      hitByPitch: parseNumber(cells[13]),
      strikeouts: parseNumber(cells[14]),
      runs: parseNumber(cells[15]),
      earnedRuns: parseNumber(cells[16]),
      opponentAverage: parseNumber(cells[17]),
      whip,
    };
  }

  return null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const pcode = searchParams.get("pcode")?.trim() ?? "";
    const opponentInput =
      searchParams.get("opponent")?.trim() ?? "";

    if (!/^\d+$/.test(pcode)) {
      return NextResponse.json(
        {
          success: false,
          message: "올바른 투수 pcode가 필요합니다.",
        },
        { status: 400 },
      );
    }

    if (!opponentInput) {
      return NextResponse.json(
        {
          success: false,
          message: "상대팀 opponent 값이 필요합니다.",
        },
        { status: 400 },
      );
    }

    const opponent = normalizeOpponent(opponentInput);

    const url =
      "https://www.koreabaseball.com/" +
      "Record/Player/PitcherDetail/Game.aspx" +
      `?playerId=${encodeURIComponent(pcode)}`;

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
        `KBO 투수 상대전적 요청 실패: ${response.status}`,
      );
    }

    const html = await response.text();

    const playerName = getPlayerName(html);

    const opponentStats = findOpponentStats(
      html,
      opponent,
    );

    return NextResponse.json({
      success: true,
      source: "KBO official Korean pitcher game records",
      updatedAt: new Date().toISOString(),
      pcode,
      playerName,
      opponent,
      found: opponentStats !== null,
      stats: opponentStats,
      message:
        opponentStats === null
          ? `${playerName} 선수의 ${opponent} 상대 기록이 없습니다.`
          : undefined,
    });
  } catch (error) {
    console.error("KBO 투수 상대전적 오류:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "투수 상대전적을 불러오지 못했습니다.",
      },
      { status: 500 },
    );
  }
}
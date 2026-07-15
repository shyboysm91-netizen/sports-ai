import { NextResponse } from "next/server";

type ParsedGame = {
  date: string;
  time: string;
  awayCode: string;
  away: string;
  awayScore: number;
  homeCode: string;
  home: string;
  homeScore: number;
  stadium: string;
};

type TeamGame = {
  date: string;
  opponent: string;
  location: "홈" | "원정";
  teamScore: number;
  opponentScore: number;
  result: "승" | "패" | "무";
  stadium: string;
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

const TEAM_CODES_BY_NAME: Record<string, string> = {
  "KIA 타이거즈": "KIA",
  "삼성 라이온즈": "SAMSUNG",
  "LG 트윈스": "LG",
  "두산 베어스": "DOOSAN",
  "KT 위즈": "KT",
  "SSG 랜더스": "SSG",
  "롯데 자이언츠": "LOTTE",
  "한화 이글스": "HANWHA",
  "NC 다이노스": "NC",
  "키움 히어로즈": "KIWOOM",
};

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTeamCode(value: string) {
  const decoded = decodeURIComponent(value).trim();

  if (TEAM_NAMES[decoded.toUpperCase()]) {
    return decoded.toUpperCase();
  }

  return TEAM_CODES_BY_NAME[decoded] ?? "";
}

function toDateString(year: number, month: string, day: string) {
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function createTeamGame(
  game: ParsedGame,
  teamCode: string,
): TeamGame {
  const isHome = game.homeCode === teamCode;

  const teamScore = isHome ? game.homeScore : game.awayScore;
  const opponentScore = isHome
    ? game.awayScore
    : game.homeScore;

  let result: TeamGame["result"] = "무";

  if (teamScore > opponentScore) {
    result = "승";
  } else if (teamScore < opponentScore) {
    result = "패";
  }

  return {
    date: game.date,
    opponent: isHome ? game.away : game.home,
    location: isHome ? "홈" : "원정",
    teamScore,
    opponentScore,
    result,
    stadium: game.stadium,
  };
}

function summarizeGames(games: TeamGame[]) {
  const wins = games.filter((game) => game.result === "승").length;
  const losses = games.filter((game) => game.result === "패").length;
  const draws = games.filter((game) => game.result === "무").length;

  const runsScored = games.reduce(
    (total, game) => total + game.teamScore,
    0,
  );

  const runsAllowed = games.reduce(
    (total, game) => total + game.opponentScore,
    0,
  );

  return {
    games: games.length,
    wins,
    losses,
    draws,
    runsScored,
    runsAllowed,
    averageRunsScored:
      games.length > 0
        ? Number((runsScored / games.length).toFixed(2))
        : 0,
    averageRunsAllowed:
      games.length > 0
        ? Number((runsAllowed / games.length).toFixed(2))
        : 0,
    form: games.map((game) => game.result).join(""),
  };
}

function parseCompletedGames(
  html: string,
  selectedYear: number,
): ParsedGame[] {
  const text = stripHtml(html);

  const dateRegex = /(\d{2})\.(\d{2})\([A-Z]{3}\)/g;
  const dateMatches = [...text.matchAll(dateRegex)];

  const teamCodes = Object.keys(TEAM_NAMES).join("|");

  const stadiumCodes =
    "JAMSIL|MUNHAK|SUWON|DAEGU|GWANGJU|SAJIK|" +
    "CHANGWON|DAEJEON|GOCHEOKSKY|ULSAN|POHANG|" +
    "CHEONGJU";

  const games: ParsedGame[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < dateMatches.length; index += 1) {
    const currentMatch = dateMatches[index];

    const month = currentMatch[1];
    const day = currentMatch[2];

    const sectionStart =
      (currentMatch.index ?? 0) + currentMatch[0].length;

    const sectionEnd =
      dateMatches[index + 1]?.index ?? text.length;

    const section = text.slice(sectionStart, sectionEnd);

    const gameRegex = new RegExp(
      `(\\d{2}:\\d{2})\\s+` +
        `(${teamCodes})\\s+` +
        `(\\d+)\\s*:\\s*(\\d+)\\s+` +
        `(${teamCodes})` +
        `[\\s\\S]*?(${stadiumCodes})`,
      "g",
    );

    for (const match of section.matchAll(gameRegex)) {
      const [
        ,
        time,
        awayCode,
        awayScoreText,
        homeScoreText,
        homeCode,
        stadium,
      ] = match;

      const date = toDateString(
        selectedYear,
        month,
        day,
      );

      const key =
        `${date}-${time}-${awayCode}-${homeCode}-` +
        `${awayScoreText}-${homeScoreText}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);

      games.push({
        date,
        time,
        awayCode,
        away: TEAM_NAMES[awayCode],
        awayScore: Number(awayScoreText),
        homeCode,
        home: TEAM_NAMES[homeCode],
        homeScore: Number(homeScoreText),
        stadium,
      });
    }
  }

  return games.sort((a, b) => {
    const first = `${a.date}T${a.time}`;
    const second = `${b.date}T${b.time}`;

    return first.localeCompare(second);
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const teamInput = searchParams.get("team") ?? "";
    const opponentInput = searchParams.get("opponent") ?? "";
    const date =
      searchParams.get("date") ??
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

    const teamCode = normalizeTeamCode(teamInput);
    const opponentCode = normalizeTeamCode(opponentInput);

    if (!teamCode) {
      return NextResponse.json(
        {
          success: false,
          message: "올바른 team 값이 필요합니다.",
        },
        { status: 400 },
      );
    }

    if (!opponentCode) {
      return NextResponse.json(
        {
          success: false,
          message: "올바른 opponent 값이 필요합니다.",
        },
        { status: 400 },
      );
    }

    const year = Number(date.slice(0, 4));

    const sourceUrl =
      "https://eng.koreabaseball.com/" +
      "Schedule/DailySchedule.aspx" +
      `?searchDate=${encodeURIComponent(date)}`;

    const response = await fetch(sourceUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
          "AppleWebKit/537.36",
        Accept: "text/html",
      },
      next: {
        revalidate: 1800,
      },
    });

    if (!response.ok) {
      throw new Error(
        `KBO 경기 결과 요청 실패: ${response.status}`,
      );
    }

    const html = await response.text();

    const allCompletedGames = parseCompletedGames(
      html,
      year,
    ).filter((game) => game.date < date);

    const teamGames = allCompletedGames
      .filter(
        (game) =>
          game.awayCode === teamCode ||
          game.homeCode === teamCode,
      )
      .map((game) => createTeamGame(game, teamCode))
      .sort((a, b) => b.date.localeCompare(a.date));

    const recent10 = teamGames.slice(0, 10);

    const headToHeadGames = allCompletedGames
      .filter(
        (game) =>
          (game.awayCode === teamCode &&
            game.homeCode === opponentCode) ||
          (game.awayCode === opponentCode &&
            game.homeCode === teamCode),
      )
      .map((game) => createTeamGame(game, teamCode))
      .sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json({
      success: true,
      source: "KBO official English schedule results",
      updatedAt: new Date().toISOString(),
      date,
      teamCode,
      team: TEAM_NAMES[teamCode],
      opponentCode,
      opponent: TEAM_NAMES[opponentCode],

      recent10: {
        summary: summarizeGames(recent10),
        games: recent10,
      },

      headToHead: {
        summary: summarizeGames(headToHeadGames),
        games: headToHeadGames,
      },
    });
  } catch (error) {
    console.error("KBO 최근 흐름·상대전적 오류:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "최근 경기와 상대전적을 불러오지 못했습니다.",
      },
      { status: 500 },
    );
  }
}
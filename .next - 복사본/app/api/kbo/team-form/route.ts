import { NextResponse } from "next/server";

type UnknownObject = Record<string, unknown>;

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
  weekday: string;
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

const TEAM_CODES_BY_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(TEAM_NAMES).map(([code, name]) => [name, code]),
);

const TEAM_ALIASES: Record<string, string> = {
  KIA: "KIA", 기아: "KIA", 타이거즈: "KIA",
  삼성: "SAMSUNG", SAMSUNG: "SAMSUNG", 라이온즈: "SAMSUNG",
  LG: "LG", 엘지: "LG", 트윈스: "LG",
  두산: "DOOSAN", DOOSAN: "DOOSAN", 베어스: "DOOSAN",
  KT: "KT", 위즈: "KT",
  SSG: "SSG", 랜더스: "SSG", SK: "SSG",
  롯데: "LOTTE", LOTTE: "LOTTE", 자이언츠: "LOTTE",
  한화: "HANWHA", HANWHA: "HANWHA", 이글스: "HANWHA",
  NC: "NC", 엔씨: "NC", 다이노스: "NC",
  키움: "KIWOOM", KIWOOM: "KIWOOM", 히어로즈: "KIWOOM", 넥센: "KIWOOM",
};

function asText(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = asText(value).replace(/[^0-9.-]/g, "");
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function objectValue(value: unknown): UnknownObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownObject)
    : {};
}

function pick(obj: UnknownObject, keys: string[]) {
  for (const key of keys) {
    const value = asText(obj[key]);
    if (value) return value;
  }
  return "";
}

function pickNumber(obj: UnknownObject, keys: string[]) {
  for (const key of keys) {
    const value = asNumber(obj[key]);
    if (value !== null) return value;
  }
  return null;
}

function collectObjects(value: unknown, out: UnknownObject[] = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectObjects(item, out));
  } else if (value && typeof value === "object") {
    const obj = value as UnknownObject;
    out.push(obj);
    Object.values(obj).forEach((item) => collectObjects(item, out));
  }
  return out;
}

function normalizeTeamCode(value: string) {
  const decoded = decodeURIComponent(value).trim();
  if (TEAM_NAMES[decoded.toUpperCase()]) return decoded.toUpperCase();
  if (TEAM_CODES_BY_NAME[decoded]) return TEAM_CODES_BY_NAME[decoded];

  const compact = decoded.replace(/\s+/g, "").toUpperCase();
  for (const [alias, code] of Object.entries(TEAM_ALIASES)) {
    if (compact.includes(alias.replace(/\s+/g, "").toUpperCase())) return code;
  }
  return "";
}

function findSideObject(game: UnknownObject, side: "away" | "home") {
  const candidates = side === "away"
    ? ["awayTeam", "away", "visitTeam", "visitorTeam", "awayTeamInfo", "team1"]
    : ["homeTeam", "home", "homeTeamInfo", "team2"];

  for (const key of candidates) {
    const obj = objectValue(game[key]);
    if (Object.keys(obj).length) return obj;
  }
  return {};
}

function normalizeDate(raw: string, fallback: string) {
  const match = raw.match(/(20\d{2})[-./]?(\d{2})[-./]?(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : fallback;
}

function normalizeTime(raw: string) {
  const match = raw.match(/(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : "";
}

function parseNaverGames(payload: unknown, fallbackDate: string): ParsedGame[] {
  const games: ParsedGame[] = [];
  const seen = new Set<string>();

  for (const obj of collectObjects(payload)) {
    const awayObj = findSideObject(obj, "away");
    const homeObj = findSideObject(obj, "home");

    const awayName = pick(awayObj, ["teamName", "name", "fullName", "shortName", "displayName"])
      || pick(obj, ["awayTeamName", "visitTeamName", "visitorTeamName", "awayName"]);
    const homeName = pick(homeObj, ["teamName", "name", "fullName", "shortName", "displayName"])
      || pick(obj, ["homeTeamName", "homeName"]);

    const awayCode = normalizeTeamCode(awayName);
    const homeCode = normalizeTeamCode(homeName);
    if (!awayCode || !homeCode || awayCode === homeCode) continue;

    const awayScore = pickNumber(awayObj, ["score", "teamScore", "run", "runs", "point", "points"])
      ?? pickNumber(obj, ["awayScore", "visitScore", "visitorScore", "awayTeamScore", "scoreAway"]);
    const homeScore = pickNumber(homeObj, ["score", "teamScore", "run", "runs", "point", "points"])
      ?? pickNumber(obj, ["homeScore", "homeTeamScore", "scoreHome"]);

    // 완료 경기만 집계합니다. 아직 점수가 없는 예정 경기는 제외합니다.
    if (awayScore === null || homeScore === null) continue;

    const status = pick(obj, ["status", "gameStatus", "state", "statusCode", "gameStatusCode"]).toLowerCase();
    if (/cancel|취소|postpone|연기|suspend/.test(status)) continue;

    const date = normalizeDate(
      pick(obj, ["gameDate", "date", "startDate", "startTime", "gameStartDateTime"]),
      fallbackDate,
    );
    const time = normalizeTime(pick(obj, ["gameTime", "time", "startTime", "gameStartDateTime"]));
    const stadiumObj = objectValue(obj.stadium);
    const stadium = pick(obj, ["stadiumName", "place", "groundName", "venueName"])
      || pick(stadiumObj, ["name", "stadiumName"]);

    const key = `${date}-${awayCode}-${homeCode}-${awayScore}-${homeScore}`;
    if (seen.has(key)) continue;
    seen.add(key);

    games.push({
      date,
      time,
      awayCode,
      away: TEAM_NAMES[awayCode],
      awayScore,
      homeCode,
      home: TEAM_NAMES[homeCode],
      homeScore,
      stadium,
    });
  }

  return games;
}

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

function parseOfficialEnglish(html: string, selectedYear: number): ParsedGame[] {
  const text = stripHtml(html);
  const dateRegex = /(\d{2})\.(\d{2})\([A-Z]{3}\)/g;
  const dateMatches = [...text.matchAll(dateRegex)];
  const teamCodes = Object.keys(TEAM_NAMES).join("|");
  const stadiumCodes = "JAMSIL|MUNHAK|SUWON|DAEGU|GWANGJU|SAJIK|CHANGWON|DAEJEON|GOCHEOKSKY|ULSAN|POHANG|CHEONGJU";
  const games: ParsedGame[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < dateMatches.length; index += 1) {
    const current = dateMatches[index];
    const date = `${selectedYear}-${current[1]}-${current[2]}`;
    const sectionStart = (current.index ?? 0) + current[0].length;
    const sectionEnd = dateMatches[index + 1]?.index ?? text.length;
    const section = text.slice(sectionStart, sectionEnd);
    const regex = new RegExp(`(\\d{2}:\\d{2})\\s+(${teamCodes})\\s+(\\d+)\\s*:\\s*(\\d+)\\s+(${teamCodes})[\\s\\S]*?(${stadiumCodes})`, "g");

    for (const match of section.matchAll(regex)) {
      const key = `${date}-${match[2]}-${match[5]}-${match[3]}-${match[4]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      games.push({
        date,
        time: match[1],
        awayCode: match[2],
        away: TEAM_NAMES[match[2]],
        awayScore: Number(match[3]),
        homeCode: match[5],
        home: TEAM_NAMES[match[5]],
        homeScore: Number(match[4]),
        stadium: match[6],
      });
    }
  }
  return games;
}

async function fetchNaverMonth(year: number, month: number) {
  const fromDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const toDate = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;
  const base = "https://api-gw.sports.naver.com/schedule/games";
  const url = `${base}?upperCategoryId=kbaseball&categoryId=kbo&fromDate=${fromDate}&toDate=${toDate}&size=200`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Referer: "https://sports.naver.com/kbaseball/schedule/index",
      Accept: "application/json, text/plain, */*",
    },
    next: { revalidate: 600 },
  });
  if (!response.ok) throw new Error(`네이버 ${month}월 일정 요청 실패: ${response.status}`);
  return parseNaverGames(await response.json(), fromDate);
}

async function fetchOfficialMonth(year: number, month: number) {
  const searchDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const response = await fetch(
    `https://eng.koreabaseball.com/Schedule/DailySchedule.aspx?searchDate=${encodeURIComponent(searchDate)}`,
    {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
      next: { revalidate: 600 },
    },
  );
  if (!response.ok) return [];
  return parseOfficialEnglish(await response.text(), year);
}

function createTeamGame(game: ParsedGame, teamCode: string): TeamGame {
  const isHome = game.homeCode === teamCode;
  const teamScore = isHome ? game.homeScore : game.awayScore;
  const opponentScore = isHome ? game.awayScore : game.homeScore;
  const result: TeamGame["result"] = teamScore > opponentScore ? "승" : teamScore < opponentScore ? "패" : "무";
  const weekday = new Intl.DateTimeFormat("ko-KR", { weekday: "short", timeZone: "Asia/Seoul" })
    .format(new Date(`${game.date}T12:00:00+09:00`));

  return {
    date: game.date,
    weekday,
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
  const runsScored = games.reduce((total, game) => total + game.teamScore, 0);
  const runsAllowed = games.reduce((total, game) => total + game.opponentScore, 0);

  return {
    games: games.length,
    wins,
    losses,
    draws,
    runsScored,
    runsAllowed,
    averageRunsScored: games.length ? Number((runsScored / games.length).toFixed(2)) : 0,
    averageRunsAllowed: games.length ? Number((runsAllowed / games.length).toFixed(2)) : 0,
    form: games.map((game) => game.result).join(""),
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const teamCode = normalizeTeamCode(searchParams.get("team") ?? "");
    const opponentCode = normalizeTeamCode(searchParams.get("opponent") ?? "");
    const date = searchParams.get("date") ?? new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());

    if (!teamCode || !opponentCode) {
      return NextResponse.json({ success: false, message: "올바른 팀 값이 필요합니다." }, { status: 400 });
    }

    const year = Number(date.slice(0, 4));
    const targetMonth = Number(date.slice(5, 7));
    const months = Array.from({ length: Math.max(1, targetMonth - 2) }, (_, index) => index + 3)
      .filter((month) => month <= targetMonth);

    const monthResults = await Promise.all(months.map(async (month) => {
      try {
        const naver = await fetchNaverMonth(year, month);
        if (naver.length) return naver;
      } catch (error) {
        console.warn(`네이버 ${month}월 일정 파싱 실패, KBO 공식 일정으로 대체합니다.`, error);
      }
      return fetchOfficialMonth(year, month);
    }));

    const allCompletedGames = monthResults
      .flat()
      .filter((game) => game.date < date)
      .filter((game, index, array) => array.findIndex((item) =>
        `${item.date}-${item.awayCode}-${item.homeCode}-${item.awayScore}-${item.homeScore}` ===
        `${game.date}-${game.awayCode}-${game.homeCode}-${game.awayScore}-${game.homeScore}`,
      ) === index);

    const teamGames = allCompletedGames
      .filter((game) => game.awayCode === teamCode || game.homeCode === teamCode)
      .map((game) => createTeamGame(game, teamCode))
      .sort((a, b) => b.date.localeCompare(a.date));

    const headToHeadGames = allCompletedGames
      .filter((game) =>
        (game.awayCode === teamCode && game.homeCode === opponentCode) ||
        (game.awayCode === opponentCode && game.homeCode === teamCode),
      )
      .map((game) => createTeamGame(game, teamCode))
      .sort((a, b) => b.date.localeCompare(a.date));

    const targetWeekday = new Intl.DateTimeFormat("ko-KR", { weekday: "short", timeZone: "Asia/Seoul" })
      .format(new Date(`${date}T12:00:00+09:00`));
    const weekdayGames = teamGames.filter((game) => game.weekday === targetWeekday);

    return NextResponse.json({
      success: true,
      source: "Naver Sports schedule (KBO official fallback)",
      updatedAt: new Date().toISOString(),
      date,
      teamCode,
      team: TEAM_NAMES[teamCode],
      opponentCode,
      opponent: TEAM_NAMES[opponentCode],
      recent10: { summary: summarizeGames(teamGames.slice(0, 10)), games: teamGames.slice(0, 10) },
      // 선발투수 일자별 기록과 상대팀을 연결할 때 사용합니다.
      // 화면에는 노출하지 않고 내부 API 보강용으로만 사용됩니다.
      seasonGames: teamGames.slice(0, 120),
      headToHead: { summary: summarizeGames(headToHeadGames), games: headToHeadGames },
      weekday: { label: targetWeekday, summary: summarizeGames(weekdayGames), games: weekdayGames },
      debug: { totalSeasonGames: allCompletedGames.length, teamGames: teamGames.length, headToHeadGames: headToHeadGames.length },
    });
  } catch (error) {
    console.error("KBO 최근 흐름·상대전적 오류:", error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "최근 경기와 상대전적을 불러오지 못했습니다.",
    }, { status: 500 });
  }
}

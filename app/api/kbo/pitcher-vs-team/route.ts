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

type RecentPitchingSummary = {
  games: number;
  wins: number;
  losses: number;
  innings: string;
  era: number;
  whip: number;
  qualityStarts: number;
};

type SplitPitchingStats = {
  label: string;
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

type VenuePitchingStats = SplitPitchingStats & {
  venue: string;
};

type PitchingSplits = {
  venue: VenuePitchingStats[];
  month: SplitPitchingStats[];
  weekday: SplitPitchingStats[];
  homeAway: SplitPitchingStats[];
  dayNight: SplitPitchingStats[];
  period: SplitPitchingStats[];
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
};

const HOME_STADIUM_WORDS: Record<string, string[]> = {
  KIA: ["광주", "챔피언스필드"],
  SAMSUNG: ["대구", "라이온즈파크"],
  LG: ["잠실"],
  DOOSAN: ["잠실"],
  KT: ["수원", "위즈파크"],
  SSG: ["문학", "인천", "랜더스필드"],
  LOTTE: ["사직"],
  HANWHA: ["대전", "이글스파크", "볼파크"],
  NC: ["창원", "NC파크"],
  KIWOOM: ["고척", "스카이돔"],
};

const PRIMARY_STADIUM_BY_TEAM: Record<string, string> = {
  KIA: "광주",
  SAMSUNG: "대구",
  LG: "잠실",
  DOOSAN: "잠실",
  KT: "수원",
  SSG: "문학",
  LOTTE: "사직",
  HANWHA: "대전",
  NC: "창원",
  KIWOOM: "고척",
};

const PLAYER_CODE_FALLBACK: Record<string, string> = {
  양현종: "77637",
  김건우: "51867",
  류현진: "76715",
};

function cleanHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
}

function numberValue(value?: string) {
  if (!value || value === "-") return 0;
  const parsed = Number(value.replace(/,/g, "").replace(/%/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseInnings(value?: string) {
  if (!value) return 0;
  const text = value.trim();
  const mixed = text.match(/^(\d+)\s+(1\/3|2\/3)$/);
  if (mixed) {
    return Number(mixed[1]) + (mixed[2] === "1/3" ? 1 / 3 : 2 / 3);
  }
  if (text === "1/3") return 1 / 3;
  if (text === "2/3") return 2 / 3;
  return Number(text) || 0;
}

function formatInnings(value: number) {
  const outs = Math.round(value * 3);
  const whole = Math.floor(outs / 3);
  const remainder = outs % 3;
  return remainder ? `${whole} ${remainder}/3` : String(whole);
}

function getRows(html: string) {
  return (html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [])
    .map((row) =>
      (row.match(/<t[hd]\b[^>]*>[\s\S]*?<\/t[hd]>/gi) ?? []).map(cleanHtml),
    )
    .filter((cells) => cells.length > 0);
}

function getPlayerName(html: string) {
  const text = cleanHtml(html);
  return (
    text.match(/선수명:\s*([가-힣A-Za-z·\-\s]+?)\s+등번호:/)?.[1]?.trim() ??
    ""
  );
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "text/html,application/xhtml+xml",
      Referer: "https://www.koreabaseball.com/",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`${response.status}`);
  }

  return response.text();
}

async function fetchHtmlSafely(url: string) {
  try {
    return await fetchHtml(url);
  } catch {
    return "";
  }
}

async function resolvePcode(name: string) {
  const target = normalize(name);
  if (!target) return "";

  const fallback = Object.entries(PLAYER_CODE_FALLBACK).find(
    ([playerName]) => normalize(playerName) === target,
  );
  if (fallback) return fallback[1];

  const urls = [
    `https://www.koreabaseball.com/Player/Search.aspx?searchWord=${encodeURIComponent(name)}`,
    `https://www.koreabaseball.com/Record/Player/Search.aspx?searchWord=${encodeURIComponent(name)}`,
  ];

  for (const url of urls) {
    const html = await fetchHtmlSafely(url);
    const links =
      html.match(/<a\b[^>]*(?:playerId|pcode)=\d+[^>]*>[\s\S]*?<\/a>/gi) ?? [];

    for (const link of links) {
      const label = normalize(cleanHtml(link));
      if (label === target || label.includes(target) || target.includes(label)) {
        const pcode = link.match(/(?:playerId|pcode)=(\d+)/i)?.[1] ?? "";
        if (pcode) return pcode;
      }
    }
  }

  return "";
}

function normalizeHeader(value: string) {
  return value
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9가-힣]/g, "");
}

function getTables(html: string) {
  return (html.match(/<table\b[^>]*>[\s\S]*?<\/table>/gi) ?? []).map((table) => {
    const rows = table.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
    return rows
      .map((row) =>
        (row.match(/<t[hd]\b[^>]*>[\s\S]*?<\/t[hd]>/gi) ?? []).map(cleanHtml),
      )
      .filter((cells) => cells.length > 0);
  });
}

function findColumn(headers: string[], aliases: string[]) {
  const normalized = headers.map(normalizeHeader);
  return normalized.findIndex((header) =>
    aliases.some((alias) => header === normalizeHeader(alias)),
  );
}

function parseSeasonStats(html: string) {
  if (!html) return null;

  const currentYear = String(new Date().getFullYear());
  const tables = getTables(html);
  const merged: Record<string, string> = {};

  const mergeRow = (headers: string[], row: string[]) => {
    headers.forEach((header, index) => {
      const key = normalizeHeader(header);
      if (key && row[index] != null && row[index] !== "") {
        merged[key] = row[index];
      }
    });
  };

  for (const rows of tables) {
    for (let index = 0; index < rows.length - 1; index += 1) {
      const headers = rows[index];
      const normalizedHeaders = headers.map(normalizeHeader);

      const isMainSeasonHeader =
        normalizedHeaders.includes("ERA") &&
        normalizedHeaders.includes("G") &&
        normalizedHeaders.includes("IP");

      const isDetailSeasonHeader =
        normalizedHeaders.includes("BB") &&
        normalizedHeaders.some((header) => header === "SO" || header === "K") &&
        normalizedHeaders.includes("WHIP");

      if (!isMainSeasonHeader && !isDetailSeasonHeader) continue;

      const row = rows[index + 1];
      if (!row || row.length === 0) continue;

      if (isMainSeasonHeader) {
        const yearIndex = findColumn(headers, ["YEAR", "연도", "시즌"]);
        if (
          yearIndex >= 0 &&
          row[yearIndex] &&
          /^20\d{2}$/.test(row[yearIndex]) &&
          row[yearIndex] !== currentYear
        ) {
          continue;
        }

        const eraIndex = findColumn(headers, ["ERA", "평균자책점"]);
        const gamesIndex = findColumn(headers, ["G", "경기"]);
        const inningsIndex = findColumn(headers, ["IP", "이닝"]);

        const eraText = row[eraIndex] ?? "";
        const gamesText = row[gamesIndex] ?? "";
        const inningsText = row[inningsIndex] ?? "";

        if (
          !/^\d+(?:\.\d+)?$/.test(eraText) ||
          !/^\d+$/.test(gamesText) ||
          !inningsText
        ) {
          continue;
        }
      }

      mergeRow(headers, row);
    }
  }

  const pick = (...aliases: string[]) => {
    for (const alias of aliases) {
      const value = merged[normalizeHeader(alias)];
      if (value != null && value !== "") return value;
    }
    return "";
  };

  const games = numberValue(pick("G", "경기"));
  const innings = pick("IP", "이닝") || "0";
  const era = numberValue(pick("ERA", "평균자책점"));

  if (games <= 0 && parseInnings(innings) <= 0) return null;

  const hits = numberValue(pick("H", "피안타"));
  const walks = numberValue(pick("BB", "볼넷"));
  const strikeouts = numberValue(pick("SO", "K", "탈삼진"));
  const homeRuns = numberValue(pick("HR", "피홈런"));
  const earnedRuns = numberValue(pick("ER", "자책점"));
  const inningsValue = parseInnings(innings);
  const calculatedWhip =
    inningsValue > 0
      ? Number(((hits + walks) / inningsValue).toFixed(2))
      : 0;

  return {
    games,
    wins: numberValue(pick("W", "승")),
    losses: numberValue(pick("L", "패")),
    innings,
    era,
    whip: numberValue(pick("WHIP")) || calculatedWhip,
    hits,
    walks,
    strikeouts,
    homeRuns,
    earnedRuns,
  };
}

function parseOpponentStats(html: string, opponent: string): OpponentPitchingStats | null {
  const rows = getRows(html);

  for (const cells of rows) {
    const opponentIndex = cells.findIndex(
      (cell) => normalize(cell) === normalize(opponent),
    );
    if (opponentIndex < 0) continue;

    const values = cells.slice(opponentIndex);
    // 상대팀, G, ERA, W, L, SV, HLD, WPCT, TBF, IP, H, HR, BB, HBP, SO, R, ER, AVG
    if (values.length < 18) continue;

    const innings = values[9] || "0";
    const inningsNumeric = parseInnings(innings);
    const hits = numberValue(values[10]);
    const walks = numberValue(values[12]);

    return {
      opponent: values[0],
      games: numberValue(values[1]),
      era: numberValue(values[2]),
      wins: numberValue(values[3]),
      losses: numberValue(values[4]),
      saves: numberValue(values[5]),
      holds: numberValue(values[6]),
      winningPercentage: numberValue(values[7]),
      battersFaced: numberValue(values[8]),
      innings,
      inningsValue: inningsNumeric,
      hits,
      homeRuns: numberValue(values[11]),
      walks,
      hitByPitch: numberValue(values[13]),
      strikeouts: numberValue(values[14]),
      runs: numberValue(values[15]),
      earnedRuns: numberValue(values[16]),
      opponentAverage: numberValue(values[17]),
      whip: inningsNumeric
        ? Number(((hits + walks) / inningsNumeric).toFixed(2))
        : 0,
    };
  }

  return null;
}

function parseRecent(html: string, limit: number): RecentPitchingSummary | null {
  const rows = getRows(html);
  const parsed: Array<{
    innings: number;
    earnedRuns: number;
    hits: number;
    walks: number;
    result: string;
  }> = [];

  for (const cells of rows) {
    const dateIndex = cells.findIndex((cell) => /^(?:\d{4}[.\-/])?\d{1,2}[.\-/]\d{1,2}$/.test(cell));
    if (dateIndex < 0) continue;

    // 실제 KBO Daily.aspx 열:
    // 일자, 상대, 구분, 결과, ERA1, TBF, IP, H, HR, BB, HBP, SO, R, ER, ERA2
    const values = cells.slice(dateIndex);
    if (values.length < 15) continue;

    const innings = parseInnings(values[6]);
    if (innings <= 0 || innings > 12) continue;

    parsed.push({
      innings,
      hits: numberValue(values[7]),
      walks: numberValue(values[9]),
      earnedRuns: numberValue(values[13]),
      result: values[3] ?? "",
    });
  }

  const selected = parsed.slice(0, limit);
  if (!selected.length) return null;

  const totals = selected.reduce(
    (acc, row) => {
      acc.innings += row.innings;
      acc.earnedRuns += row.earnedRuns;
      acc.hits += row.hits;
      acc.walks += row.walks;
      if (row.result === "승") acc.wins += 1;
      if (row.result === "패") acc.losses += 1;
      if (row.innings >= 6 && row.earnedRuns <= 3) acc.qualityStarts += 1;
      return acc;
    },
    { innings: 0, earnedRuns: 0, hits: 0, walks: 0, wins: 0, losses: 0, qualityStarts: 0 },
  );

  return {
    games: selected.length,
    wins: totals.wins,
    losses: totals.losses,
    innings: formatInnings(totals.innings),
    era: Number(((totals.earnedRuns * 9) / totals.innings).toFixed(2)),
    whip: Number(((totals.hits + totals.walks) / totals.innings).toFixed(2)),
    qualityStarts: totals.qualityStarts,
  };
}

function parseSplitRow(cells: string[]): SplitPitchingStats | null {
  // 구분, G, ERA, W, L, SV, HLD, WPCT, TBF, IP, H, HR, BB, HBP, SO, R, ER, AVG
  if (cells.length < 18) return null;
  const label = cells[0]?.trim();
  if (!label || label === "구분") return null;

  const inningsValue = parseInnings(cells[9]);
  const hits = numberValue(cells[10]);
  const walks = numberValue(cells[12]);

  return {
    label,
    games: numberValue(cells[1]),
    era: numberValue(cells[2]),
    wins: numberValue(cells[3]),
    losses: numberValue(cells[4]),
    saves: numberValue(cells[5]),
    holds: numberValue(cells[6]),
    winningPercentage: numberValue(cells[7]),
    battersFaced: numberValue(cells[8]),
    innings: cells[9] || "0",
    inningsValue,
    hits,
    homeRuns: numberValue(cells[11]),
    walks,
    hitByPitch: numberValue(cells[13]),
    strikeouts: numberValue(cells[14]),
    runs: numberValue(cells[15]),
    earnedRuns: numberValue(cells[16]),
    opponentAverage: numberValue(cells[17]),
    whip:
      inningsValue > 0
        ? Number(((hits + walks) / inningsValue).toFixed(2))
        : 0,
  };
}

function extractSectionTable(html: string, heading: string): SplitPitchingStats[] {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // 1순위: 제목(h5) 바로 다음 표
  const byHeading = new RegExp(
    `<h5\\b[^>]*>[\\s\\S]*?${escapedHeading}[\\s\\S]*?<\\/h5>[\\s\\S]*?<table\\b[^>]*>([\\s\\S]*?)<\\/table>`,
    "i",
  ).exec(html)?.[1];

  // 2순위: table summary 속성
  const bySummary = new RegExp(
    `<table\\b[^>]*summary=["'][^"']*${escapedHeading}[^"']*["'][^>]*>([\\s\\S]*?)<\\/table>`,
    "i",
  ).exec(html)?.[1];

  const section = byHeading ?? bySummary ?? "";
  if (!section) return [];

  return getRows(section)
    .map(parseSplitRow)
    .filter((row): row is SplitPitchingStats => Boolean(row));
}

function normalizeStadiumLabel(value: string) {
  const compact = normalize(value);
  const aliases: Array<[string[], string]> = [
    [["광주", "챔피언스필드", "gwangju"], "광주"],
    [["잠실", "jamsil"], "잠실"],
    [["문학", "인천", "랜더스필드", "munhak"], "문학"],
    [["수원", "위즈파크", "suwon"], "수원"],
    [["대구", "라이온즈파크", "daegu"], "대구"],
    [["사직", "sajik"], "사직"],
    [["창원", "nc파크", "changwon"], "창원"],
    [["대전", "볼파크", "이글스파크", "daejeon"], "대전"],
    [["고척", "스카이돔", "gocheoksky"], "고척"],
    [["울산", "ulsan"], "울산"],
    [["포항", "pohang"], "포항"],
    [["청주", "cheongju"], "청주"],
  ];

  for (const [words, canonical] of aliases) {
    if (words.some((word) => compact.includes(normalize(word)))) return canonical;
  }
  return value.trim();
}

function parseGamePageSplits(html: string): PitchingSplits {
  const venue = extractSectionTable(html, "구장별").map((row) => ({
    ...row,
    venue: row.label,
  }));

  return {
    venue,
    month: extractSectionTable(html, "월별"),
    weekday: extractSectionTable(html, "요일별"),
    homeAway: extractSectionTable(html, "홈/방문별"),
    dayNight: extractSectionTable(html, "주/야간별"),
    period: extractSectionTable(html, "기간별"),
  };
}

function findCurrentSplit(
  rows: SplitPitchingStats[],
  candidates: string[],
): SplitPitchingStats | null {
  const normalizedCandidates = candidates.map(normalize);
  return (
    rows.find((row) =>
      normalizedCandidates.some((candidate) => normalize(row.label) === candidate),
    ) ?? null
  );
}

function getKoreanWeekday(date: string) {
  const label = new Intl.DateTimeFormat("ko-KR", {
    weekday: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(`${date}T12:00:00+09:00`));
  return label.replace("요일", "").replace("(", "").replace(")", "");
}

function inferHomeAway(
  team: string,
  stadium: string,
  side: string,
) {
  if (side === "home") return "홈";
  if (side === "away") return "방문";

  const homeWords = HOME_STADIUM_WORDS[team] ?? [];
  const normalizedStadium = normalize(stadium);
  const isHome = homeWords.some((word) =>
    normalizedStadium.includes(normalize(word)),
  );
  return isHome ? "홈" : "방문";
}

function inferDayNight(time: string) {
  const hour = Number(time.match(/^(\d{1,2}):/)?.[1]);
  if (!Number.isFinite(hour)) return "";
  return hour < 17 ? "주간" : "야간";
}

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    let pcode = searchParams.get("pcode")?.trim() ?? "";
    const name = searchParams.get("name")?.trim() ?? "";
    const team = searchParams.get("team")?.toUpperCase() ?? "";
    const opponentCode = searchParams.get("opponent")?.toUpperCase() ?? "";
    const stadium = searchParams.get("stadium")?.trim() ?? "";
    const side = searchParams.get("side")?.trim().toLowerCase() ?? "";
    const homeTeam = searchParams.get("homeTeam")?.trim().toUpperCase() ?? "";

    if (!/^\d+$/.test(pcode)) {
      pcode = await resolvePcode(name);
    }

    if (!/^\d+$/.test(pcode)) {
      return NextResponse.json(
        {
          success: false,
          message: `${name || "선발투수"} 선수 코드를 찾지 못했습니다.`,
        },
        { status: 404 },
      );
    }

    const opponent = OPPONENT_NAMES[opponentCode] ?? opponentCode;
    const base = "https://www.koreabaseball.com/Record/Player/PitcherDetail";

    // 한 페이지가 실패해도 다른 기록까지 전부 버리지 않도록 각각 독립적으로 요청합니다.
    const [basicHtml, dailyHtml, gameHtml] = await Promise.all([
      fetchHtmlSafely(`${base}/Basic.aspx?playerId=${pcode}`),
      fetchHtmlSafely(`${base}/Daily.aspx?playerId=${pcode}`),
      fetchHtmlSafely(`${base}/Game.aspx?playerId=${pcode}`),
    ]);

    if (!basicHtml && !dailyHtml && !gameHtml) {
      throw new Error("KBO 선수 기록 페이지를 모두 불러오지 못했습니다.");
    }

    const seasonStats = parseSeasonStats(basicHtml);
    const stats = parseOpponentStats(gameHtml, opponent);
    const recent5 = parseRecent(dailyHtml, 5);
    const recent10 = parseRecent(dailyHtml, 10);
    const splits = parseGamePageSplits(gameHtml);
    const resolvedStadium =
      stadium || PRIMARY_STADIUM_BY_TEAM[homeTeam] || "";
    const normalizedVenue = normalizeStadiumLabel(resolvedStadium);
    const venueStats = splits.venue;
    const currentVenueStats =
      venueStats.find((row) => {
        const rowVenue = normalizeStadiumLabel(row.venue);
        return (
          rowVenue === normalizedVenue ||
          normalize(rowVenue).includes(normalize(normalizedVenue)) ||
          normalize(normalizedVenue).includes(normalize(rowVenue))
        );
      }) ?? null;

    const requestDate =
      searchParams.get("date") ??
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
    const requestTime = searchParams.get("time") ?? "";

    const currentMonthStats = findCurrentSplit(splits.month, [
      `${Number(requestDate.slice(5, 7))}월`,
      requestDate.slice(5, 7),
    ]);
    const weekdayLabel = getKoreanWeekday(requestDate);
    const currentWeekdayStats = findCurrentSplit(splits.weekday, [
      weekdayLabel,
      `${weekdayLabel}요일`,
    ]);
    const homeAwayLabel = inferHomeAway(team, resolvedStadium, side);
    const currentHomeAwayStats = findCurrentSplit(splits.homeAway, [
      homeAwayLabel,
      homeAwayLabel === "방문" ? "원정" : "홈",
    ]);
    const dayNightLabel = inferDayNight(requestTime);
    const currentDayNightStats = dayNightLabel
      ? findCurrentSplit(splits.dayNight, [dayNightLabel])
      : null;

    return NextResponse.json({
      success: true,
      source: "KBO official pitcher records",
      updatedAt: new Date().toISOString(),
      pcode,
      playerName:
        getPlayerName(basicHtml) || getPlayerName(dailyHtml) || name,
      opponent,
      found: stats !== null,
      stats,
      stadium: resolvedStadium,
      venueStats,
      currentVenueStats,
      splits,
      currentMonthStats,
      currentWeekdayStats,
      currentHomeAwayStats,
      currentDayNightStats,
      recent5,
      recent10,
      seasonStats,
      debug: {
        basicLoaded: Boolean(basicHtml),
        dailyLoaded: Boolean(dailyHtml),
        gameLoaded: Boolean(gameHtml),
        requestedStadium: stadium,
        resolvedStadium,
        normalizedVenue,
        venueLabels: venueStats.map((row) => row.venue),
        side,
        homeTeam,
        directGamePageSplitsLoaded:
          splits.venue.length +
            splits.month.length +
            splits.weekday.length +
            splits.homeAway.length +
            splits.dayNight.length +
            splits.period.length >
          0,
        splitCounts: {
          venue: splits.venue.length,
          month: splits.month.length,
          weekday: splits.weekday.length,
          homeAway: splits.homeAway.length,
          dayNight: splits.dayNight.length,
          period: splits.period.length,
        },
        seasonFound: Boolean(seasonStats),
      },
    });
  } catch (error) {
    console.error("KBO 선발투수 상세 기록 오류:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "선발투수 상세 기록을 불러오지 못했습니다.",
      },
      { status: 500 },
    );
  }
}

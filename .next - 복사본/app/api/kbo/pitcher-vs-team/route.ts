import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

type RecentPitchingDetail = {
  date: string;
  opponent: string;
  homeAway: string;
  decision: string;
  innings: string;
  earnedRuns: number;
  walks: number;
  strikeouts: number;
  pitches: number | null;
};

type RecentPitchingSummary = {
  games: number;
  wins: number;
  losses: number;
  innings: string;
  era: number;
  whip: number;
  qualityStarts: number;
  gamesDetail?: RecentPitchingDetail[];
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



const KBO_TEAM_ALIASES: Record<string, string> = {
  KIA: "KIA", "KIA 타이거즈": "KIA", 타이거즈: "KIA",
  삼성: "SAMSUNG", "삼성 라이온즈": "SAMSUNG", 라이온즈: "SAMSUNG",
  LG: "LG", "LG 트윈스": "LG", 트윈스: "LG",
  두산: "DOOSAN", "두산 베어스": "DOOSAN", 베어스: "DOOSAN",
  KT: "KT", "KT 위즈": "KT", 위즈: "KT",
  SSG: "SSG", "SSG 랜더스": "SSG", 랜더스: "SSG",
  롯데: "LOTTE", "롯데 자이언츠": "LOTTE", 자이언츠: "LOTTE",
  한화: "HANWHA", "한화 이글스": "HANWHA", 이글스: "HANWHA",
  NC: "NC", "NC 다이노스": "NC", 다이노스: "NC",
  키움: "KIWOOM", "키움 히어로즈": "KIWOOM", 히어로즈: "KIWOOM",
};

const KBO_TEAM_FULL_NAME: Record<string, string> = {
  KIA: "KIA 타이거즈", SAMSUNG: "삼성 라이온즈", LG: "LG 트윈스",
  DOOSAN: "두산 베어스", KT: "KT 위즈", SSG: "SSG 랜더스",
  LOTTE: "롯데 자이언츠", HANWHA: "한화 이글스", NC: "NC 다이노스",
  KIWOOM: "키움 히어로즈",
};

// KBO 공식 페이지의 이미지 경로·내부 코드에서 사용되는 구단 약어입니다.
// 일자별 표에서 상대팀 텍스트가 빠져도 엠블럼 코드로 상대팀을 복원합니다.
const KBO_OFFICIAL_TEAM_CODE: Record<string, string> = {
  HT: "KIA", KIA: "KIA",
  SS: "SAMSUNG", SAMSUNG: "SAMSUNG",
  LG: "LG",
  OB: "DOOSAN", DOOSAN: "DOOSAN",
  KT: "KT",
  SK: "SSG", SSG: "SSG",
  LT: "LOTTE", LOTTE: "LOTTE",
  HH: "HANWHA", HANWHA: "HANWHA",
  NC: "NC",
  WO: "KIWOOM", KIWOOM: "KIWOOM",
};

function normalizeKboTeamCode(value: unknown) {
  const text = String(value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (KBO_TEAM_ALIASES[text]) return KBO_TEAM_ALIASES[text];
  const compact = normalize(text);
  for (const [alias, code] of Object.entries(KBO_TEAM_ALIASES)) {
    if (compact === normalize(alias) || compact.includes(normalize(alias))) return code;
  }
  return "";
}

function collectJsonObjects(value: unknown, out: Record<string, unknown>[] = []) {
  if (Array.isArray(value)) value.forEach((item) => collectJsonObjects(item, out));
  else if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    out.push(object);
    Object.values(object).forEach((item) => collectJsonObjects(item, out));
  }
  return out;
}

function firstText(object: Record<string, unknown> | undefined, keys: string[]) {
  if (!object) return "";
  for (const key of keys) {
    const value = object[key];
    if (typeof value === "string" || typeof value === "number") {
      const text = String(value).trim();
      if (text) return text;
    }
  }
  return "";
}

function objectAt(object: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = object[key];
    if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  }
  return undefined;
}

async function naverGameSupplement(date: string, team: string) {
  try {
    const base = "https://api-gw.sports.naver.com/schedule/games";
    const query = `upperCategoryId=kbaseball&categoryId=kbo&fromDate=${date}&toDate=${date}&size=100`;
    const response = await fetch(`${base}?${query}`, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = await response.json();

    const readText = (value: unknown) =>
      typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
    const readObject = (value: unknown) =>
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    const pickText = (object: Record<string, unknown>, keys: string[]) => {
      for (const key of keys) {
        const value = readText(object[key]);
        if (value) return value;
      }
      return "";
    };
    const sideObject = (object: Record<string, unknown>, side: "away" | "home") => {
      const keys = side === "away"
        ? ["awayTeam", "away", "visitTeam", "visitorTeam", "awayTeamInfo"]
        : ["homeTeam", "home", "homeTeamInfo"];
      for (const key of keys) {
        const found = readObject(object[key]);
        if (Object.keys(found).length) return found;
      }
      return {};
    };
    const flattenValues = (
      value: unknown,
      path = "",
      out: Array<{ path: string; value: unknown }> = [],
    ) => {
      if (Array.isArray(value)) {
        value.forEach((item, index) => flattenValues(item, `${path}[${index}]`, out));
      } else if (value && typeof value === "object") {
        Object.entries(value as Record<string, unknown>).forEach(([key, child]) =>
          flattenValues(child, path ? `${path}.${key}` : key, out),
        );
      } else {
        out.push({ path, value });
      }
      return out;
    };
    const findTeamFromFlattened = (object: Record<string, unknown>, side: "away" | "home") => {
      const sidePattern = side === "away" ? /(away|visit|visitor)/i : /home/i;
      const namePattern = /(team.*name|name.*team|fullName|shortName|displayName)$/i;
      for (const entry of flattenValues(object)) {
        if (!sidePattern.test(entry.path) || !namePattern.test(entry.path)) continue;
        const code = normalizeKboTeamCode(readText(entry.value));
        if (code) return code;
      }
      return "";
    };

    for (const object of collectJsonObjects(payload)) {
      const awayObj = sideObject(object, "away");
      const homeObj = sideObject(object, "home");
      const awayText =
        pickText(awayObj, ["teamName", "name", "fullName", "shortName", "displayName", "teamCode", "code"]) ||
        pickText(object, ["awayTeamName", "visitTeamName", "visitorTeamName", "awayName", "visitName"]);
      const homeText =
        pickText(homeObj, ["teamName", "name", "fullName", "shortName", "displayName", "teamCode", "code"]) ||
        pickText(object, ["homeTeamName", "homeName"]);
      const awayCode = normalizeKboTeamCode(awayText) || findTeamFromFlattened(object, "away");
      const homeCode = normalizeKboTeamCode(homeText) || findTeamFromFlattened(object, "home");
      if (!awayCode || !homeCode || (awayCode !== team && homeCode !== team)) continue;

      const rawDate =
        pickText(object, ["gameDate", "date", "startDate", "localDate", "matchDate", "gameStartDateTime"]) ||
        flattenValues(object)
          .map((entry) => readText(entry.value))
          .find((value) => value.includes(date)) ||
        "";
      const foundDate = rawDate.match(/\d{4}-\d{2}-\d{2}/)?.[0];
      if (foundDate && foundDate !== date) continue;

      const isHome = homeCode === team;
      const opponentCode = isHome ? awayCode : homeCode;
      return {
        opponent: KBO_TEAM_FULL_NAME[opponentCode] || opponentCode,
        homeAway: isHome ? "홈" : "원정",
      };
    }
  } catch {
    return null;
  }
  return null;
}

const MYKBO_BASE = "https://mykbostats.com";
const MYKBO_TEAM_SCHEDULE: Record<string, string> = {
  DOOSAN: "1-Doosan-Bears", HANWHA: "4-Hanwha-Eagles", KIA: "5-Kia-Tigers",
  KIWOOM: "23-Kiwoom-Heroes", KT: "22-KT-Wiz", LG: "6-LG-Twins",
  LOTTE: "2-Lotte-Giants", NC: "9-NC-Dinos", SAMSUNG: "3-Samsung-Lions", SSG: "24-SSG-Landers",
};
const MYKBO_URL_TEAM: Record<string, string> = {
  DOOSAN: "Doosan", HANWHA: "Hanwha", KIA: "Kia", KIWOOM: "Kiwoom", KT: "KT",
  LG: "LG", LOTTE: "Lotte", NC: "NC", SAMSUNG: "Samsung", SSG: "SSG",
};
const MYKBO_TEAM_KO: Record<string, string> = {
  Doosan: "두산 베어스", Hanwha: "한화 이글스", Kia: "KIA 타이거즈", Kiwoom: "키움 히어로즈",
  KT: "KT 위즈", LG: "LG 트윈스", Lotte: "롯데 자이언츠", NC: "NC 다이노스",
  Samsung: "삼성 라이온즈", SSG: "SSG 랜더스",
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


function kstDateText(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function weekStartText(dateText: string) {
  const date = new Date(`${dateText}T12:00:00+09:00`);
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return kstDateText(date);
}

function myKboGameLinks(text: string, team: string, allowedDates: Set<string>) {
  const token = MYKBO_URL_TEAM[team];
  if (!token) return [] as string[];
  const decoded = text.replace(/&amp;/gi, "&").replace(/\\n/g, "\n");
  const links = [...decoded.matchAll(/(?:https?:\/\/mykbostats\.com)?(\/games\/\d+-[A-Za-z]+-vs-[A-Za-z]+-\d{8})/gi)]
    .map((match) => match[1])
    .filter((href) => {
      const raw = href.match(/(\d{8})$/)?.[1];
      if (!raw) return false;
      const date = `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`;
      return allowedDates.has(date) && new RegExp(`(?:^|-)${token}(?:-vs-|-|$)`, "i").test(href);
    });
  return [...new Set(links)];
}

function myKboPitchingTables(html: string) {
  const start = html.search(/>\s*Pitching\s*</i);
  const source = start >= 0 ? html.slice(start) : html;
  return (source.match(/<table\b[^>]*>[\s\S]*?<\/table>/gi) ?? []).filter((table) => {
    const text = cleanHtml(table);
    return /\bERA\b/i.test(text) && /\bIP\b/i.test(text) && /\bNP\b/i.test(text);
  });
}

function myKboStarterPitches(html: string, href: string, team: string) {
  const tables = myKboPitchingTables(html);
  const match = href.match(/\/games\/\d+-([A-Za-z]+)-vs-([A-Za-z]+)-\d{8}$/i);
  const teams = match ? [match[1], match[2]] : [];
  const index = teams.findIndex((value) => value.toLowerCase() === (MYKBO_URL_TEAM[team] || "").toLowerCase());
  const table = tables[index >= 0 ? index : 0];
  if (!table) return null;
  const rows = table.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  let headers: string[] = [];
  for (const row of rows) {
    const cells = (row.match(/<t[dh]\b[^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []).map(cleanHtml);
    if (!cells.length) continue;
    if (cells.some((cell) => cell.toUpperCase() === "NP") && cells.some((cell) => cell.toUpperCase() === "IP")) { headers = cells.map((cell) => cell.toUpperCase()); continue; }
    if (!/href=["']\/players\/\d+-/i.test(row)) continue;
    const player = cleanHtml(row.match(/href=["']\/players\/\d+-[^"']+["'][^>]*>([\s\S]*?)<\/a>/i)?.[1] || "");
    const playerIndex = cells.findIndex((cell) => normalize(cell) === normalize(player));
    const stats = playerIndex >= 0 ? cells.slice(playerIndex + 1) : cells.slice(1);
    const npIndex = Math.max(0, headers.findIndex((value) => value === "NP") - 1);
    const pitches = numberValue(stats[npIndex]);
    return pitches > 0 ? pitches : null;
  }
  return null;
}

async function enrichRecentDetails(summary: RecentPitchingSummary | null, team: string, opponentCode: string, requestDate: string, origin: string) {
  const details = summary?.gamesDetail;
  if (!details?.length) return summary;

  const year = requestDate.slice(0, 4);
  const normalizedDates = details.map((row) => {
    const cleaned = row.date.replace(/[.\/]/g, "-");
    const md = cleaned.replace(/^\d{4}-/, "");
    return `${year}-${md.padStart(5, "0")}`;
  });

  // 이미 사이트에서 정상 작동 중인 KBO 팀 경기 일정 API를 우선 사용합니다.
  // 이 API는 네이버 일정 + KBO 공식 일정 fallback을 함께 사용하므로 날짜별 상대팀 매칭이 가장 안정적입니다.
  const teamFormByDate = new Map<string, { opponent: string; homeAway: string }>();
  try {
    const response = await fetch(
      `${origin}/api/kbo/team-form?team=${encodeURIComponent(team)}&opponent=${encodeURIComponent(opponentCode || team)}&date=${encodeURIComponent(requestDate)}&starterScheduleVersion=2`,
      { cache: "no-store", headers: { Accept: "application/json" } },
    );
    if (response.ok) {
      const payload = await response.json() as {
        seasonGames?: Array<{ date?: string; opponent?: string; location?: string }>;
        recent10?: { games?: Array<{ date?: string; opponent?: string; location?: string }> };
      };
      const games = payload.seasonGames || payload.recent10?.games || [];
      for (const game of games) {
        if (!game.date || !game.opponent) continue;
        teamFormByDate.set(game.date, {
          opponent: game.opponent,
          homeAway: game.location === "홈" ? "홈" : "원정",
        });
      }
    }
  } catch {
    // 아래 날짜별 보조 조회와 원본 표 파싱으로 계속 진행합니다.
  }

  // 팀 일정 API에 없는 날짜만 날짜별 네이버 일정으로 한 번 더 보강합니다.
  const scheduleRows = await Promise.all(normalizedDates.map((date) =>
    teamFormByDate.has(date) ? Promise.resolve(teamFormByDate.get(date)!) : naverGameSupplement(date, team),
  ));

  // 실제 투구수는 MyKBO 경기 박스스코어에서 보완합니다. 실패해도 상대팀 표시는 유지됩니다.
  const pitchesByDate = new Map<string, number | null>();
  const myKboGameByDate = new Map<string, { opponent: string; homeAway: string }>();
  const scheduleSlug = MYKBO_TEAM_SCHEDULE[team];
  if (scheduleSlug) {
    const allowed = new Set(normalizedDates);
    const weeks = [...new Set(normalizedDates.map(weekStartText))];
    const pages = await Promise.all(
      [...weeks.map((week) => `${MYKBO_BASE}/schedule/${scheduleSlug}/week_of/${week}`), `${MYKBO_BASE}/games/feed_for/${scheduleSlug}`]
        .map((url) => fetchHtmlSafely(url)),
    );
    const links = [...new Set(pages.flatMap((page) => myKboGameLinks(page, team, allowed)))];
    await Promise.all(links.map(async (href) => {
      const gameMatch = href.match(/\/games\/\d+-([A-Za-z]+)-vs-([A-Za-z]+)-(\d{8})$/i);
      if (!gameMatch) return;

      // MyKBO 경기 URL은 "원정팀-vs-홈팀" 순서입니다.
      // 네이버 일정 응답 형식이 바뀌어도 이 URL에서 상대팀과 홈/원정을 확실히 복원합니다.
      const [, awayToken, homeToken, raw] = gameMatch;
      const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
      const ownToken = MYKBO_URL_TEAM[team]?.toLowerCase();
      const isAway = awayToken.toLowerCase() === ownToken;
      const isHome = homeToken.toLowerCase() === ownToken;
      if (isAway || isHome) {
        const opponentToken = isAway ? homeToken : awayToken;
        myKboGameByDate.set(date, {
          opponent: MYKBO_TEAM_KO[opponentToken] || opponentToken,
          homeAway: isHome ? "홈" : "원정",
        });
      }

      const html = await fetchHtmlSafely(`${MYKBO_BASE}${href}`);
      pitchesByDate.set(date, html ? myKboStarterPitches(html, href, team) : null);
    }));
  }

  return {
    ...summary,
    gamesDetail: details.map((row, index) => {
      const date = normalizedDates[index];
      const schedule = scheduleRows[index];
      const myKboGame = myKboGameByDate.get(date);
      const pitches = pitchesByDate.get(date);
      const parsedOpponent = row.opponent && row.opponent !== "-" && row.opponent !== "선발"
        ? KBO_TEAM_FULL_NAME[normalizeKboTeamCode(row.opponent)] || row.opponent
        : "";
      return {
        ...row,
        opponent: myKboGame?.opponent || schedule?.opponent || parsedOpponent || "-",
        homeAway: myKboGame?.homeAway || schedule?.homeAway || (/^(홈|원정|방문)$/.test(row.homeAway) ? row.homeAway.replace("방문", "원정") : "-"),
        pitches: pitches ?? row.pitches,
      };
    }),
  };
}

function opponentFromRawDailyRow(rowHtml: string, cells: string[], team: string) {
  const ownCode = normalizeKboTeamCode(team);
  const candidates: string[] = [...cells];

  for (const match of rowHtml.matchAll(/(?:alt|title|data-team-name|data-team|aria-label)=["']([^"']+)["']/gi)) {
    candidates.push(cleanHtml(match[1]));
  }
  for (const match of rowHtml.matchAll(/(?:teamCode|teamId|teamName)=([^&"'<>\s]+)/gi)) {
    candidates.push(decodeURIComponent(match[1]));
  }

  // 공식 KBO 일자별 기록은 상대팀 이름 대신 엠블럼 이미지 코드만 넣는 경우가 있습니다.
  // 예: emblem_HT.png, logo_OB.svg, teamCode=LT
  for (const match of rowHtml.matchAll(/(?:emblem|logo|team)[_\/-]?([A-Za-z]{2,8})(?:[_\.-]|\b)/gi)) {
    const raw = match[1].toUpperCase();
    const code = KBO_OFFICIAL_TEAM_CODE[raw] || normalizeKboTeamCode(raw);
    if (code && code !== ownCode) return KBO_TEAM_FULL_NAME[code] || code;
  }

  for (const candidate of candidates) {
    const raw = candidate.trim().toUpperCase();
    const code = KBO_OFFICIAL_TEAM_CODE[raw] || normalizeKboTeamCode(candidate);
    if (code && code !== ownCode) return KBO_TEAM_FULL_NAME[code] || candidate;
  }

  const text = cleanHtml(rowHtml);
  for (const [alias, code] of Object.entries(KBO_TEAM_ALIASES)) {
    if (code === ownCode) continue;
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(?:vs\\s*|@\\s*|상대\\s*)${escaped}(?:\\s|$)`, "i").test(text)) {
      return KBO_TEAM_FULL_NAME[code] || alias;
    }
  }
  return "";
}

function homeAwayFromRawDailyRow(rowHtml: string) {
  const text = cleanHtml(rowHtml);
  if (/(?:^|\s)(?:원정|방문|@)(?:\s|$)/.test(text)) return "원정";
  if (/(?:^|\s)홈(?:\s|$)/.test(text)) return "홈";
  return "-";
}

function parseRecent(html: string, limit: number, team: string): RecentPitchingSummary | null {
  const rawRows = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  const parsed: Array<{
    date: string;
    opponent: string;
    homeAway: string;
    innings: number;
    inningsText: string;
    earnedRuns: number;
    hits: number;
    walks: number;
    strikeouts: number;
    pitches: number | null;
    result: string;
  }> = [];

  for (const rowHtml of rawRows) {
    const cells = (rowHtml.match(/<t[hd]\b[^>]*>[\s\S]*?<\/t[hd]>/gi) ?? []).map(cleanHtml);
    const dateIndex = cells.findIndex((cell) => /^(?:\d{4}[.\-/])?\d{1,2}[.\-/]\d{1,2}$/.test(cell));
    if (dateIndex < 0) continue;

    // 실제 KBO Daily.aspx 열:
    // 일자, 상대, 구분, 결과, ERA1, TBF, IP, H, HR, BB, HBP, SO, R, ER, ERA2
    const values = cells.slice(dateIndex);
    if (values.length < 15) continue;

    const innings = parseInnings(values[6]);
    if (innings <= 0 || innings > 12) continue;

    const rawPitchCount = numberValue(values[5]);
    // KBO 일자별 기록의 상대팀은 날짜 바로 다음 열(values[1])입니다.
    // 이전 구현은 행 전체에서 팀명을 추측하면서 "선발" 열을 잘못 읽는 경우가 있었습니다.
    const directOpponent = opponentFromRawDailyRow(rowHtml, values, team);
    const opponentCode = normalizeKboTeamCode(values[1]);
    const opponentName = directOpponent || (opponentCode && opponentCode !== normalizeKboTeamCode(team)
      ? KBO_TEAM_FULL_NAME[opponentCode] || OPPONENT_NAMES[opponentCode] || values[1]
      : "-");

    parsed.push({
      date: values[0] ?? "",
      opponent: opponentName,
      homeAway: homeAwayFromRawDailyRow(rowHtml),
      innings,
      inningsText: values[6] ?? formatInnings(innings),
      hits: numberValue(values[7]),
      walks: numberValue(values[9]),
      strikeouts: numberValue(values[11]),
      earnedRuns: numberValue(values[13]),
      // KBO 표에 실제 투구수 열이 제공될 때만 표시합니다. TBF처럼 작은 값은 투구수로 오인하지 않습니다.
      pitches: rawPitchCount >= 35 ? rawPitchCount : null,
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
    gamesDetail: selected.map((row) => ({
      date: row.date,
      opponent: row.opponent,
      homeAway: row.homeAway,
      decision: row.result === "승" || row.result === "패" ? row.result : "-",
      innings: row.inningsText,
      earnedRuns: row.earnedRuns,
      walks: row.walks,
      strikeouts: row.strikeouts,
      pitches: row.pitches,
    })),
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
    const requestDate =
      searchParams.get("date") ??
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
      }).format(new Date());
    const parsedRecent10 = parseRecent(dailyHtml, 10, team);
    const parsedRecent5 = parseRecent(dailyHtml, 5, team);
    const origin = new URL(request.url).origin;
    const [recent10, recent5] = await Promise.all([
      enrichRecentDetails(parsedRecent10, team, opponentCode, requestDate, origin),
      enrichRecentDetails(parsedRecent5, team, opponentCode, requestDate, origin),
    ]);
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

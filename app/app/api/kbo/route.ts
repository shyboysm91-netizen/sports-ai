import { NextResponse } from "next/server";

type KboGame = {
  league: "KBO";
  date: string;
  time: string;
  away: string;
  home: string;
  stadium: string;
  awayStarter: string;
  homeStarter: string;
  awayStarterCode: string;
  homeStarterCode: string;
};

type UnknownObject = Record<string, unknown>;

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

const TEAM_ALIASES: Record<string, string> = {
  KIA: "KIA 타이거즈", 기아: "KIA 타이거즈", 타이거즈: "KIA 타이거즈",
  삼성: "삼성 라이온즈", SAMSUNG: "삼성 라이온즈", 라이온즈: "삼성 라이온즈",
  LG: "LG 트윈스", 엘지: "LG 트윈스", 트윈스: "LG 트윈스",
  두산: "두산 베어스", DOOSAN: "두산 베어스", 베어스: "두산 베어스",
  KT: "KT 위즈", 위즈: "KT 위즈",
  SSG: "SSG 랜더스", 랜더스: "SSG 랜더스",
  롯데: "롯데 자이언츠", LOTTE: "롯데 자이언츠", 자이언츠: "롯데 자이언츠",
  한화: "한화 이글스", HANWHA: "한화 이글스", 이글스: "한화 이글스",
  NC: "NC 다이노스", 엔씨: "NC 다이노스", 다이노스: "NC 다이노스",
  키움: "키움 히어로즈", KIWOOM: "키움 히어로즈", 히어로즈: "키움 히어로즈",
};

function koreaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function asText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }
  return "";
}

function pick(obj: UnknownObject, keys: string[]) {
  for (const key of keys) {
    const value = asText(obj[key]);
    if (value) return value;
  }
  return "";
}

function normalizeTeam(raw: string) {
  const compact = raw.replace(/\s+/g, "").toUpperCase();
  for (const [alias, full] of Object.entries(TEAM_ALIASES)) {
    if (compact.includes(alias.replace(/\s+/g, "").toUpperCase())) return full;
  }
  return raw;
}

function objectValue(value: unknown): UnknownObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownObject)
    : {};
}

function findSideObject(game: UnknownObject, side: "away" | "home") {
  const candidates = side === "away"
    ? ["awayTeam", "away", "visitTeam", "visitorTeam", "awayTeamInfo"]
    : ["homeTeam", "home", "homeTeamInfo"];

  for (const key of candidates) {
    const obj = objectValue(game[key]);
    if (Object.keys(obj).length) return obj;
  }
  return {};
}

function flatten(value: unknown, path = "", out: Array<{ path: string; value: unknown }> = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => flatten(item, `${path}[${index}]`, out));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as UnknownObject)) {
      flatten(child, path ? `${path}.${key}` : key, out);
    }
  } else {
    out.push({ path, value });
  }
  return out;
}

function cleanPlayerName(value: string) {
  return value
    .replace(/^(선발|투수)\s*/g, "")
    .replace(/\s*\(.*?\)\s*$/g, "")
    .trim();
}

function looksLikePlayerName(value: string) {
  if (!value || value.length > 30) return false;
  if (/^\d+$/.test(value)) return false;
  if (/^(미정|예정|선발|투수|-)$/.test(value)) return false;
  return /[가-힣A-Za-z]/.test(value);
}

function findStarter(game: UnknownObject, side: "away" | "home") {
  const sideObj = findSideObject(game, side);
  const sideWords = side === "away" ? ["away", "visit", "visitor"] : ["home"];
  const directKeys = sideWords.flatMap((prefix) => [
    `${prefix}Starter`, `${prefix}StartingPitcher`, `${prefix}Pitcher`,
    `${prefix}ProbablePitcher`, `${prefix}StarterName`, `${prefix}PitcherName`,
    `${prefix}StartingPitcherName`, `${prefix}StartingPlayer`,
  ]);

  for (const key of directKeys) {
    const raw = game[key];
    const obj = objectValue(raw);
    if (Object.keys(obj).length) {
      const name = pick(obj, ["name", "playerName", "korName", "koreanName", "displayName", "shortName"]);
      const code = pick(obj, ["pcode", "playerId", "playerCode", "id", "code"]);
      if (looksLikePlayerName(name)) return { name: cleanPlayerName(name), code };
    }
    const name = cleanPlayerName(asText(raw));
    if (looksLikePlayerName(name)) return { name, code: "" };
  }

  for (const key of ["starter", "startingPitcher", "pitcher", "probablePitcher", "startingPlayer", "startingPitcherInfo"]) {
    const raw = sideObj[key];
    const obj = objectValue(raw);
    if (Object.keys(obj).length) {
      const name = pick(obj, ["name", "playerName", "korName", "koreanName", "displayName", "shortName"]);
      const code = pick(obj, ["pcode", "playerId", "playerCode", "id", "code"]);
      if (looksLikePlayerName(name)) return { name: cleanPlayerName(name), code };
    }
    const name = cleanPlayerName(asText(raw));
    if (looksLikePlayerName(name)) return { name, code: "" };
  }

  // 네이버 API 필드명이 바뀌어도 starter/pitcher 경로를 찾아냅니다.
  const flattened = flatten(game);
  const sidePattern = side === "away" ? /(away|visit|visitor)/i : /home/i;
  const pitcherPattern = /(starter|starting.*pitcher|pitcher.*name|probable.*pitcher|startingplayer)/i;

  const nameEntry = flattened.find(({ path, value }) => {
    const stringValue = cleanPlayerName(asText(value));
    return sidePattern.test(path) && pitcherPattern.test(path) && looksLikePlayerName(stringValue);
  });

  if (nameEntry) {
    const basePath = nameEntry.path.replace(/\.(name|playerName|korName|koreanName|displayName|shortName)$/i, "");
    const codeEntry = flattened.find(({ path }) =>
      path.startsWith(basePath) && /\.(pcode|playerId|playerCode|id|code)$/i.test(path),
    );
    return {
      name: cleanPlayerName(asText(nameEntry.value)),
      code: asText(codeEntry?.value),
    };
  }

  return { name: "", code: "" };
}

function collectObjects(value: unknown, out: UnknownObject[] = []) {
  if (Array.isArray(value)) value.forEach((item) => collectObjects(item, out));
  else if (value && typeof value === "object") {
    const obj = value as UnknownObject;
    out.push(obj);
    Object.values(obj).forEach((item) => collectObjects(item, out));
  }
  return out;
}

function parseNaver(payload: unknown, date: string): KboGame[] {
  const objects = collectObjects(payload);
  const games: KboGame[] = [];
  const seen = new Set<string>();

  for (const obj of objects) {
    const awayObj = findSideObject(obj, "away");
    const homeObj = findSideObject(obj, "home");
    const awayRaw = pick(awayObj, ["teamName", "name", "fullName", "shortName"])
      || pick(obj, ["awayTeamName", "visitTeamName", "visitorTeamName"]);
    const homeRaw = pick(homeObj, ["teamName", "name", "fullName", "shortName"])
      || pick(obj, ["homeTeamName"]);

    if (!awayRaw || !homeRaw) continue;

    const away = normalizeTeam(awayRaw);
    const home = normalizeTeam(homeRaw);
    if (!Object.values(TEAM_NAMES).includes(away) || !Object.values(TEAM_NAMES).includes(home)) continue;

    const gameDate = pick(obj, ["gameDate", "date", "startDate"]).slice(0, 10) || date;
    if (gameDate !== date) continue;

    const rawTime = pick(obj, ["gameTime", "time", "startTime"]);
    const timeMatch = rawTime.match(/(\d{1,2}):(\d{2})/);
    const time = timeMatch ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}` : "";
    const stadiumObj = objectValue(obj.stadium);
    const stadium = pick(obj, ["stadiumName", "place", "groundName"])
      || pick(stadiumObj, ["name", "stadiumName"]);

    const awayStarter = findStarter(obj, "away");
    const homeStarter = findStarter(obj, "home");
    const key = `${gameDate}-${time}-${away}-${home}`;
    if (seen.has(key)) continue;
    seen.add(key);

    games.push({
      league: "KBO",
      date,
      time,
      away,
      home,
      stadium,
      awayStarter: awayStarter.name,
      homeStarter: homeStarter.name,
      awayStarterCode: awayStarter.code,
      homeStarterCode: homeStarter.code,
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
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function loadOfficialFallback(date: string): Promise<KboGame[]> {
  const month = date.slice(5, 7);
  const day = date.slice(8, 10);
  const response = await fetch(
    `https://eng.koreabaseball.com/Schedule/DailySchedule.aspx?searchDate=${date}`,
    { headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" }, next: { revalidate: 300 } },
  );
  if (!response.ok) return [];

  const raw = stripHtml(await response.text());
  const marker = `${month}.${day}`;
  const start = raw.indexOf(marker);
  if (start < 0) return [];

  const next = /\d{2}\.\d{2}\([A-Z]{3}\)/g;
  next.lastIndex = start + marker.length;
  const end = next.exec(raw)?.index ?? raw.length;
  const dayText = raw.slice(start, end);
  const teams = Object.keys(TEAM_NAMES).join("|");
  const stadiums = "JAMSIL|MUNHAK|SUWON|DAEGU|GWANGJU|SAJIK|CHANGWON|DAEJEON|GOCHEOKSKY";
  const regex = new RegExp(`(\\d{2}:\\d{2})\\s+(${teams})\\s+(?:\\d+\\s*:\\s*\\d+|:)\\s+(${teams})[\\s\\S]*?(${stadiums})`, "g");

  return [...dayText.matchAll(regex)].map((match) => ({
    league: "KBO" as const,
    date,
    time: match[1],
    away: TEAM_NAMES[match[2]],
    home: TEAM_NAMES[match[3]],
    stadium: match[4],
    awayStarter: "",
    homeStarter: "",
    awayStarterCode: "",
    homeStarterCode: "",
  }));
}

async function loadNaver(date: string) {
  const base = "https://api-gw.sports.naver.com/schedule/games";
  const common = `upperCategoryId=kbaseball&categoryId=kbo&fromDate=${date}&toDate=${date}&size=100`;
  const urls = [
    `${base}?${common}`,
    `${base}?fields=basic%2Csports%2Cbaseball&${common}`,
    `${base}?fields=basic%2Csports&${common}`,
  ];

  let best: KboGame[] = [];
  for (const url of urls) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: "https://sports.naver.com/kbaseball/schedule/index",
        Accept: "application/json, text/plain, */*",
      },
      next: { revalidate: 300 },
    });
    if (!response.ok) continue;

    const parsed = parseNaver(await response.json(), date);
    if (parsed.length > best.length || parsed.filter((g) => g.awayStarter || g.homeStarter).length > best.filter((g) => g.awayStarter || g.homeStarter).length) {
      best = parsed;
    }
    if (best.length && best.every((game) => game.awayStarter && game.homeStarter)) break;
  }
  return best;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? koreaToday();

  try {
    const naverGames = await loadNaver(date);
    if (naverGames.length) {
      return NextResponse.json({
        success: true,
        source: "Naver Sports schedule",
        date,
        count: naverGames.length,
        games: naverGames,
        message: naverGames.some((game) => !game.awayStarter || !game.homeStarter)
          ? "일부 경기의 예고 선발 정보가 제공되지 않았습니다."
          : undefined,
      });
    }

    const games = await loadOfficialFallback(date);
    return NextResponse.json({
      success: true,
      source: "KBO official schedule fallback",
      date,
      count: games.length,
      games,
      message: "예고 선발 정보는 확인하지 못했습니다.",
    });
  } catch (error) {
    console.error("KBO 일정 오류:", error);
    const games = await loadOfficialFallback(date).catch(() => []);
    return NextResponse.json({
      success: true,
      source: "KBO official schedule fallback",
      date,
      count: games.length,
      games,
      message: "예고 선발 정보는 확인하지 못했습니다.",
    });
  }
}

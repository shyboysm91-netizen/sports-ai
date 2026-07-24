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
  awayScore?: number;
  homeScore?: number;
  completed?: boolean;
  status?: string;
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


function scoreFromFlattened(game: UnknownObject, side: "away" | "home") {
  const entries = flatten(game);
  const sidePattern = side === "away" ? /(away|visit|visitor)/i : /home/i;
  const scorePattern = /(score|runs?|point|resultScore|teamScore)/i;

  for (const { path, value } of entries) {
    if (!sidePattern.test(path) || !scorePattern.test(path)) continue;
    const raw = asText(value).trim();
    if (!/^\d{1,2}$/.test(raw)) continue;
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0 && n <= 30) return n;
  }
  return undefined;
}

function statusFromFlattened(game: UnknownObject) {
  const entries = flatten(game);
  const hit = entries.find(({ path, value }) =>
    /(status|state|result|gameStatus|gameState)/i.test(path) &&
    /종료|경기종료|FINAL|END|RESULT|COMPLETED/i.test(asText(value)),
  );
  return hit ? asText(hit.value) : "";
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
  const candidates = new Map<string, KboGame>();

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

    const rawDate = pick(obj, ["gameDate", "date", "startDate", "localDate", "matchDate"]);
    const gameDate = (rawDate.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? date);
    if (gameDate !== date) continue;

    const rawTime = pick(obj, ["gameTime", "time", "startTime", "localTime"]);
    const timeMatch = rawTime.match(/(\d{1,2}):(\d{2})/);
    const time = timeMatch ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}` : "";
    const stadiumObj = objectValue(obj.stadium);
    const stadium = pick(obj, ["stadiumName", "place", "groundName", "venueName"])
      || pick(stadiumObj, ["name", "stadiumName"]);

    const awayStarter = findStarter(obj, "away");
    const homeStarter = findStarter(obj, "home");

    const awayScoreText = pick(awayObj, ["score", "teamScore", "runs", "run", "point", "resultScore", "totalScore"])
      || pick(obj, ["awayScore", "awayTeamScore", "visitScore", "visitTeamScore", "visitorScore", "visitorTeamScore"]);
    const homeScoreText = pick(homeObj, ["score", "teamScore", "runs", "run", "point", "resultScore", "totalScore"])
      || pick(obj, ["homeScore", "homeTeamScore"]);
    const directAwayScore = /^\d{1,2}$/.test(awayScoreText) ? Number(awayScoreText) : undefined;
    const directHomeScore = /^\d{1,2}$/.test(homeScoreText) ? Number(homeScoreText) : undefined;
    const awayScore = directAwayScore ?? scoreFromFlattened(obj, "away");
    const homeScore = directHomeScore ?? scoreFromFlattened(obj, "home");
    const status = pick(obj, ["status", "gameStatus", "state", "gameState", "statusCode", "gameStatusCode", "statusName"])
      || statusFromFlattened(obj);
    const completed = awayScore !== undefined && homeScore !== undefined
      && (/종료|경기종료|FINAL|END|RESULT|COMPLETED/i.test(status) || gameDate < koreaToday());

    const game: KboGame = {
      league: "KBO", date: gameDate, time, away, home, stadium,
      awayStarter: awayStarter.name, homeStarter: homeStarter.name,
      awayStarterCode: awayStarter.code, homeStarterCode: homeStarter.code,
      awayScore, homeScore, completed, status,
    };

    // 같은 경기의 상위/하위 JSON 객체가 여러 번 잡힐 수 있습니다.
    // 처음 발견한 객체를 바로 확정하지 않고, 점수·상태·선발 정보가 많은 객체를 남깁니다.
    const key = `${gameDate}-${away}-${home}`;
    const previous = candidates.get(key);
    const quality = (item: KboGame) =>
      (item.awayScore !== undefined ? 20 : 0) +
      (item.homeScore !== undefined ? 20 : 0) +
      (item.completed ? 10 : 0) +
      (item.status ? 3 : 0) +
      (item.time ? 2 : 0) +
      (item.stadium ? 2 : 0) +
      (item.awayStarter ? 2 : 0) +
      (item.homeStarter ? 2 : 0);

    if (!previous || quality(game) > quality(previous)) candidates.set(key, game);
  }

  return [...candidates.values()].sort((a, b) => a.time.localeCompare(b.time));
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
  // 과거 경기 결과는 KBO 공식 Scoreboard를 우선 사용합니다.
  // 이 페이지는 "NC 7 FINAL 5 LG" 형태로 최종 점수를 직접 제공합니다.
  const scoreboardUrl = `https://eng.koreabaseball.com/Schedule/Scoreboard.aspx?searchDate=${date}`;
  const response = await fetch(scoreboardUrl, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
    cache: "no-store",
  });
  if (!response.ok) return [];

  const text = stripHtml(await response.text());
  const teamCodes = Object.keys(TEAM_NAMES).sort((a, b) => b.length - a.length);
  const teamPattern = teamCodes.join("|");
  const stadiumPattern = "JAMSIL|MUNHAK|INCHEON|SUWON|DAEGU|GWANGJU|SAJIK|CHANGWON|DAEJEON|GOCHEOKSKY|POHANG|ULSAN|CHEONGJU";
  const headerRe = new RegExp(`\\b(${teamPattern})\\s+(\\d{1,2})\\s+(FINAL|CANCELLED|CANCELED|POSTPONED|SUSPENDED)\\s+(\\d{1,2})\\s+(${teamPattern})\\b`, "gi");
  const matches = [...text.matchAll(headerRe)];
  const games: KboGame[] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const awayCode = match[1].toUpperCase();
    const awayScore = Number(match[2]);
    const state = match[3].toUpperCase();
    const homeScore = Number(match[4]);
    const homeCode = match[5].toUpperCase();
    if (!TEAM_NAMES[awayCode] || !TEAM_NAMES[homeCode]) continue;

    const chunkStart = (match.index ?? 0) + match[0].length;
    const chunkEnd = index + 1 < matches.length ? (matches[index + 1].index ?? text.length) : text.length;
    const chunk = text.slice(chunkStart, chunkEnd);
    const stadiumMatch = chunk.match(new RegExp(`\\b(${stadiumPattern})\\b`, "i"));
    const timeMatch = chunk.match(/\b([0-2]\d:[0-5]\d)\b/);
    const completed = state === "FINAL";

    games.push({
      league: "KBO",
      date,
      time: timeMatch?.[1] ?? "",
      away: TEAM_NAMES[awayCode],
      home: TEAM_NAMES[homeCode],
      stadium: stadiumMatch?.[1] ?? "",
      awayStarter: "",
      homeStarter: "",
      awayStarterCode: "",
      homeStarterCode: "",
      awayScore: completed ? awayScore : undefined,
      homeScore: completed ? homeScore : undefined,
      completed,
      status: state,
    });
  }

  return games;
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
    const isPast = date < koreaToday();
    if (isPast) {
      const [naverGames, officialGames] = await Promise.all([
        loadNaver(date).catch(() => []),
        loadOfficialFallback(date).catch(() => []),
      ]);

      const base = naverGames.length ? naverGames : officialGames;
      if (base.length) {
        const merged = base.map((game) => {
          const official = officialGames.find((item) => item.away === game.away && item.home === game.home);
          const naver = naverGames.find((item) => item.away === game.away && item.home === game.home);
          return {
            ...game,
            time: game.time || naver?.time || official?.time || "",
            stadium: game.stadium || naver?.stadium || official?.stadium || "",
            awayStarter: naver?.awayStarter || game.awayStarter,
            homeStarter: naver?.homeStarter || game.homeStarter,
            awayStarterCode: naver?.awayStarterCode || game.awayStarterCode,
            homeStarterCode: naver?.homeStarterCode || game.homeStarterCode,
            awayScore: naver?.awayScore ?? official?.awayScore ?? game.awayScore,
            homeScore: naver?.homeScore ?? official?.homeScore ?? game.homeScore,
            completed: naver?.completed ?? official?.completed ?? game.completed,
            status: naver?.status || official?.status || game.status,
          };
        });
        return NextResponse.json({ success: true, source: "Naver Sports + KBO official scoreboard", date, count: merged.length, games: merged });
      }
    }

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

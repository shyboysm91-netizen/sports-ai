import { NextResponse } from "next/server";
import { cleanHtml, findTeam, inningsToOuts, outsToInnings, playerNameKo } from "../_shared";

type Appearance = {
  date: string;
  opponent: string;
  venue: string;
  side: "home" | "away";
  inningsOuts: number;
  innings: string;
  hits: number;
  walks: number;
  hitByPitch: number;
  strikeouts: number;
  earnedRuns: number;
  era: number;
  decision: string;
  pitches: number | null;
};

type GameLink = {
  url: string;
  date: string;
  opponent: string;
  venue: string;
  side: "home" | "away";
};

const TEAM_ALIASES: Array<{ ko: string; aliases: string[] }> = [
  { ko: "한신 타이거스", aliases: ["Hanshin Tigers", "Hanshin"] },
  { ko: "요미우리 자이언츠", aliases: ["Yomiuri Giants", "Yomiuri"] },
  { ko: "요코하마 DeNA 베이스타스", aliases: ["YOKOHAMA DeNA BAYSTARS", "Yokohama DeNA BayStars", "DeNA", "Yokohama"] },
  { ko: "주니치 드래건스", aliases: ["Chunichi Dragons", "Chunichi"] },
  { ko: "히로시마 도요 카프", aliases: ["Hiroshima Toyo Carp", "Hiroshima"] },
  { ko: "도쿄 야쿠르트 스왈로스", aliases: ["Tokyo Yakult Swallows", "Yakult"] },
  { ko: "후쿠오카 소프트뱅크 호크스", aliases: ["Fukuoka SoftBank Hawks", "Fukuoka Softbank Hawks", "SoftBank", "Softbank"] },
  { ko: "홋카이도 닛폰햄 파이터스", aliases: ["Hokkaido Nippon-Ham Fighters", "Nippon-Ham"] },
  { ko: "오릭스 버팔로스", aliases: ["ORIX Buffaloes", "ORIX", "Orix"] },
  { ko: "도호쿠 라쿠텐 골든이글스", aliases: ["Tohoku Rakuten Golden Eagles", "Rakuten"] },
  { ko: "사이타마 세이부 라이온스", aliases: ["Saitama Seibu Lions", "Seibu"] },
  { ko: "지바 롯데 마린스", aliases: ["Chiba Lotte Marines", "Lotte"] },
];

const VENUES: Record<string, string> = {
  "Jingu": "메이지 진구구장",
  "Tokyo Dome": "도쿄 돔",
  "Yokohama": "요코하마 스타디움",
  "Vantelin Dome": "반테린 돔 나고야",
  "Mazda Stadium": "마쓰다 스타디움",
  "Koshien": "한신 고시엔구장",
  "Mizuho PayPay": "미즈호 PayPay 돔",
  "ES CON FIELD": "에스콘 필드 홋카이도",
  "Kyocera Dome": "교세라 돔 오사카",
  "Rakuten Mobile": "라쿠텐 모바일 파크",
  "Belluna Dome": "벨루나 돔",
  "ZOZO Marine": "ZOZO 마린 스타디움",
  "Hotto Motto": "홋토못토 필드 고베",
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
}

function samePitcher(a: string, b: string) {
  const aa = normalize(a.replace(/\([^)]*\)/g, ""));
  const bb = normalize(b.replace(/\([^)]*\)/g, ""));
  return aa === bb || (aa.length >= 5 && bb.length >= 5 && (aa.includes(bb) || bb.includes(aa)));
}

function aliasesIn(text: string) {
  const lower = text.toLowerCase();
  return TEAM_ALIASES
    .map((team) => {
      const found = team.aliases
        .map((alias) => ({ alias, index: lower.indexOf(alias.toLowerCase()) }))
        .filter((item) => item.index >= 0)
        .sort((a, b) => a.index - b.index || b.alias.length - a.alias.length)[0];
      return found ? { ...team, ...found } : null;
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.index - b.index) as Array<{ko:string; alias:string; index:number}>;
}

function venueKo(value: string) {
  const clean = value.trim();
  const key = Object.keys(VENUES).find((item) => clean.toLowerCase().includes(item.toLowerCase()));
  return key ? VENUES[key] : clean;
}

function anchorParts(html: string) {
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map((match) => ({
    attrs: match[1],
    text: cleanHtml(match[2]),
    href: (match[1].match(/href=["']([^"']+)["']/i)?.[1] || ""),
  }));
}

function parseGameLinks(html: string, date: string, requestedTeam: string): GameLink[] {
  const year = date.slice(0, 4);
  const links: GameLink[] = [];

  for (const anchor of anchorParts(html)) {
    if (!/s\d{13}\.html/i.test(anchor.href) || !/\bGame\b/i.test(anchor.text)) continue;
    const teams = aliasesIn(anchor.text);
    if (teams.length !== 2) continue;
    if (!teams.some((team) => team.ko === requestedTeam)) continue;

    const first = teams[0];
    const second = teams[1];
    const between = anchor.text.slice(first.index + first.alias.length, second.index).replace(/\s+/g, " ").trim();
    const match = between.match(/^(\d{1,2})\s+Game\s+\d+\s+(.+?)\s+(\d{1,2})$/i);
    if (!match) continue;

    // NPB 날짜별 일정 표는 첫 번째 팀이 원정, 두 번째 팀이 홈입니다.
    // 공식 박스스코어도 타격/투수 기록을 원정팀 → 홈팀 순서로 배치합니다.
    const awayTeam = first.ko;
    const homeTeam = second.ko;
    const side: "home" | "away" = requestedTeam === homeTeam ? "home" : "away";
    const opponent = requestedTeam === homeTeam ? awayTeam : homeTeam;
    const href = anchor.href.startsWith("http")
      ? anchor.href
      : new URL(anchor.href, `https://npb.jp/bis/eng/${year}/games/`).toString();

    links.push({ url: href, date, opponent, venue: venueKo(match[2]), side });
  }
  return links;
}

function n(value: string | undefined) {
  const parsed = Number((value || "").replace(/,/g, "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseInnings(value: string) {
  const text = value.trim().replace(/⅓/g, " 1/3").replace(/⅔/g, " 2/3");
  const mixed = text.match(/^(\d+)\s+([12])\/3$/);
  if (mixed) return Number(mixed[1]) * 3 + Number(mixed[2]);
  const fractionOnly = text.match(/^([12])\/3$/);
  if (fractionOnly) return Number(fractionOnly[1]);
  return inningsToOuts(text);
}

type TableCell = { html: string; text: string };

function tableCells(rawRow: string): TableCell[] {
  return [...rawRow.matchAll(/<t[dh]\b[^>]*>[\s\S]*?<\/t[dh]>/gi)].map((match) => ({
    html: match[0],
    text: cleanHtml(match[0]).replace(/\s+/g, " ").trim(),
  }));
}

function headerKey(value: string) {
  return value.toLowerCase().replace(/\s+/g, "").replace(/[.／/()（）・:-]/g, "");
}

function headerIndex(headers: string[], aliases: string[]) {
  const keys = headers.map(headerKey);
  return keys.findIndex((key) => aliases.some((alias) => {
    const target = headerKey(alias);
    // H/R/K/IP/ER처럼 짧은 영문 약어는 반드시 정확히 일치시킨다.
    // 부분 일치를 허용하면 Pitcher 열을 H나 ER 열로 잘못 판단할 수 있다.
    if (/^[a-z]{1,3}$/.test(target)) return key === target;
    return key === target || key.includes(target);
  }));
}

type ParsedPitchingRow = {
  starterOriginalName: string;
  playerCode: string;
  inningsOuts: number;
  battersFaced: number;
  hits: number;
  walks: number;
  hitByPitch: number;
  strikeouts: number;
  earnedRuns: number;
  runs: number;
  decision: string;
  pitches: number | null;
};

function parsePitchingRows(table: string): ParsedPitchingRow[] {
  const rows = table.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  if (!rows.length) return [];

  const headerCells = rows
    .map((row) => tableCells(row).map((cell) => cell.text.trim()))
    .find((cells) => {
      const keys = cells.map(headerKey);
      return keys.some((key) => ["ip", "投球回", "回"].includes(key))
        && keys.some((key) => ["er", "自責点", "自責"].includes(key));
    }) ?? [];

  const findHeader = (aliases: string[]) => headerIndex(headerCells, aliases);
  let indexes = {
    innings: findHeader(["IP", "投球回", "回"]),
    batters: findHeader(["BF", "打者", "対打者"]),
    pitches: findHeader(["NP", "Pitches", "Pitch", "球数"]),
    hits: findHeader(["H", "被安打", "安打"]),
    walks: findHeader(["BB", "四球", "与四球"]),
    hitByPitch: findHeader(["HB", "HBP", "死球", "与死球"]),
    strikeouts: findHeader(["SO", "K", "三振", "奪三振"]),
    runs: findHeader(["R", "失点"]),
    earnedRuns: findHeader(["ER", "自責点", "自責"]),
  };

  // NPB 영문 페이지는 헤더를 IP 행과 BF/H/BB/HB/SO/ER 행으로 나눠 놓는다.
  // 이 경우 한 행에서 헤더를 찾을 수 없으므로 공식 고정 순서를 사용한다.
  if (indexes.innings < 0 || indexes.earnedRuns < 0) {
    const text = cleanHtml(table).replace(/\s+/g, " ");
    if (/\bIP\b/i.test(text) && /\bBF\b/i.test(text) && /\bSO\b/i.test(text) && /\bER\b/i.test(text)) {
      indexes = { innings: 1, batters: 2, pitches: -1, hits: 3, walks: 4, hitByPitch: 5, strikeouts: 6, runs: -1, earnedRuns: 7 };
    } else {
      return [];
    }
  }

  const parsed: ParsedPitchingRow[] = [];
  for (const rawRow of rows) {
    const cells = tableCells(rawRow);
    if (cells.length < 3) continue;

    const texts = cells.map((cell) => cell.text.trim());
    const rowKeys = texts.map(headerKey);
    if (rowKeys.some((key) => key === "ip" || key === "投球回")) continue;

    // NPB 경기 박스스코어의 투수 이름은 링크가 없는 일반 td인 경우가 대부분이다.
    // 기존 코드는 선수 링크가 있는 타격 행만 골라 잘못된 숫자를 투수 기록으로 읽었다.
    const firstStatHeader = [indexes.innings, indexes.batters, indexes.pitches, indexes.hits]
      .filter((value) => value >= 0)
      .sort((a, b) => a - b)[0] ?? 1;
    const nameIndex = Math.max(0, firstStatHeader - 1);
    const rawName = texts[nameIndex] || texts[0] || "";
    if (!rawName || /^pitcher$/i.test(rawName) || /^(投手|合計)$/.test(rawName)) continue;

    const shift = nameIndex + 1 - firstStatHeader;
    const valueAt = (headerPosition: number) => {
      if (headerPosition < 0) return "";
      return texts[headerPosition + shift] || "";
    };

    const inningsOuts = parseInnings(valueAt(indexes.innings));
    if (inningsOuts <= 0 || inningsOuts > 36) continue;

    const decisionCode = rawName.match(/\((W|L|S|H)\)/i)?.[1]?.toUpperCase()
      || rawName.match(/(?:^|\s)(勝|敗)(?:\s|$)/)?.[1]
      || "";
    const cleanName = rawName
      .replace(/,?\s*\((?:W|L|S|H)(?:[^)]*)\)\s*/gi, "")
      .replace(/(?:^|\s)(勝|敗)(?:\s|$)/g, " ")
      .trim();
    const playerCode = cells[nameIndex]?.html.match(/\/players\/(\d+)\.html/i)?.[1] || "";
    const pitchCount = n(valueAt(indexes.pitches));
    const earnedRuns = n(valueAt(indexes.earnedRuns));
    const runsText = valueAt(indexes.runs);

    parsed.push({
      starterOriginalName: cleanName,
      playerCode,
      inningsOuts,
      battersFaced: n(valueAt(indexes.batters)),
      hits: n(valueAt(indexes.hits)),
      walks: n(valueAt(indexes.walks)),
      hitByPitch: n(valueAt(indexes.hitByPitch)),
      strikeouts: n(valueAt(indexes.strikeouts)),
      earnedRuns,
      runs: runsText ? n(runsText) : earnedRuns,
      decision: decisionCode === "W" || decisionCode === "勝" ? "승" : decisionCode === "L" || decisionCode === "敗" ? "패" : "-",
      pitches: pitchCount > 0 ? pitchCount : null,
    });
  }
  return parsed;
}

function selectPitcherRow(table: string, originalName: string, koName: string, playerCode = "") {
  const rows = parsePitchingRows(table);
  if (!rows.length) return null;

  // MLB gameLog처럼 해당 선수의 경기 행만 사용한다. 팀 투수표 첫 행을 무조건
  // 가져오던 기존 방식 때문에 모든 날짜가 다른 선발투수의 기록으로 섞였다.
  if (playerCode) {
    const byCode = rows.find((row) => row.playerCode === playerCode);
    if (byCode) return byCode;
  }
  const requested = [originalName, koName, playerNameKo(originalName)].filter(Boolean);
  return rows.find((row) => requested.some((name) =>
    samePitcher(row.starterOriginalName, name)
    || samePitcher(playerNameKo(row.starterOriginalName), name),
  )) ?? null;
}

function pitchingTables(html: string) {
  return (html.match(/<table\b[^>]*>[\s\S]*?<\/table>/gi) ?? []).filter((table) => {
    const text = cleanHtml(table).replace(/\s+/g, " ");
    // NPB 영문 박스스코어는 투수표 헤더에 "Pitcher" 문구 없이
    // IP / BF / H / BB / HB / SO / ER만 표시되는 페이지가 많습니다.
    const english = /\bIP\b/i.test(text) && /\bBF\b/i.test(text) && /\bBB\b/i.test(text) && /\bSO\b/i.test(text) && /\bER\b/i.test(text);
    const japanese = /(投球回|回)/.test(text) && /(打者|対打者)/.test(text) && /(四球|与四球)/.test(text) && /(三振|奪三振)/.test(text) && /(自責点|自責)/.test(text);
    return english || japanese;
  });
}

async function getText(url: string, revalidate: number) {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
    next: { revalidate },
  });
  return response.ok ? response.text() : "";
}

async function appearanceFromGame(game: GameLink, originalName: string, koName: string, playerCode = ""): Promise<Appearance | null> {
  const englishHtml = await getText(game.url, 21600);
  if (!englishHtml) return null;

  const englishTables = pitchingTables(englishHtml);
  const englishTeamTable = game.side === "away" ? englishTables[0] : englishTables[1];
  if (!englishTeamTable) return null;

  const englishRows = parsePitchingRows(englishTeamTable);
  const starterRow = englishRows[0];
  if (!starterRow) return null;

  // 최근 '선발' 등판만 표시한다. 팀의 첫 번째 투수와 요청 투수가 다르면 제외한다.
  const requestedNames = [originalName, koName, playerNameKo(originalName)].filter(Boolean);
  const codeMatches = Boolean(playerCode && starterRow.playerCode && starterRow.playerCode === playerCode);
  const nameMatches = requestedNames.some((name) =>
    samePitcher(starterRow.starterOriginalName, name)
    || samePitcher(playerNameKo(starterRow.starterOriginalName), name),
  );
  if (!codeMatches && !nameMatches) return null;

  let pitches = starterRow.pitches;
  if (pitches == null) {
    const japaneseUrl = game.url.replace("/bis/eng/", "/bis/");
    if (japaneseUrl !== game.url) {
      const japaneseHtml = await getText(japaneseUrl, 21600);
      const japaneseTables = japaneseHtml ? pitchingTables(japaneseHtml) : [];
      const japaneseTeamTable = game.side === "away" ? japaneseTables[0] : japaneseTables[1];
      const japaneseStarter = japaneseTeamTable ? parsePitchingRows(japaneseTeamTable)[0] : null;
      if (japaneseStarter?.pitches != null) pitches = japaneseStarter.pitches;
    }
  }

  const innings = starterRow.inningsOuts / 3;
  return {
    ...game,
    inningsOuts: starterRow.inningsOuts,
    innings: outsToInnings(starterRow.inningsOuts),
    hits: starterRow.hits,
    walks: starterRow.walks,
    hitByPitch: starterRow.hitByPitch,
    strikeouts: starterRow.strikeouts,
    earnedRuns: starterRow.earnedRuns,
    era: innings ? starterRow.earnedRuns * 9 / innings : 0,
    decision: starterRow.decision,
    pitches,
  };
}

function aggregate(items: Appearance[]) {
  const outs = items.reduce((sum, item) => sum + item.inningsOuts, 0);
  const er = items.reduce((sum, item) => sum + item.earnedRuns, 0);
  const hits = items.reduce((sum, item) => sum + item.hits, 0);
  const walks = items.reduce((sum, item) => sum + item.walks, 0);
  const strikeouts = items.reduce((sum, item) => sum + item.strikeouts, 0);
  const innings = outs / 3;

  return {
    games: items.length,
    innings: outsToInnings(outs),
    era: innings ? er * 9 / innings : 0,
    whip: innings ? (hits + walks) / innings : 0,
    hits,
    walks,
    strikeouts,
    earnedRuns: er,
    summary: items.length
      ? `${items.length}경기 ${outsToInnings(outs)}이닝 · ERA ${(innings ? er * 9 / innings : 0).toFixed(2)} · WHIP ${(innings ? (hits + walks) / innings : 0).toFixed(2)}`
      : "등판 기록 없음",
  };
}

function kstDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const team = findTeam(query.get("team") || "");
  const opponent = findTeam(query.get("opponent") || "");
  const originalName = query.get("originalName") || query.get("pitcher") || "";
  const koName = query.get("name") || playerNameKo(originalName);
  const playerCode = query.get("playerCode") || "";
  const stadium = query.get("stadium") || "";
  const endText = query.get("date") || kstDate(new Date());

  if (!team || !originalName) {
    return NextResponse.json({ success: false, message: "팀 또는 투수 이름이 없습니다." }, { status: 400 });
  }

  try {
    const end = new Date(`${endText}T12:00:00+09:00`);
    const dates = Array.from({ length: 140 }, (_, index) => {
      const target = new Date(end);
      target.setDate(target.getDate() - index - 1);
      return kstDate(target);
    });

    const appearances: Appearance[] = [];

    for (let offset = 0; offset < dates.length && appearances.length < 12; offset += 7) {
      const batchDates = dates.slice(offset, offset + 7);
      const schedules = await Promise.all(batchDates.map(async (date) => {
        const year = date.slice(0, 4);
        const html = await getText(`https://npb.jp/bis/eng/${year}/games/gm${date.replaceAll("-", "")}.html`, 21600);
        return html ? parseGameLinks(html, date, team.ko) : [];
      }));

      // 날짜별 경기 박스스코어를 병렬 조회하되, 최근 10경기를 채우면 즉시 다음 과거 날짜 탐색을 멈춘다.
      const gameLinks = schedules.flat();
      const found = await Promise.all(gameLinks.map((game) => appearanceFromGame(game, originalName, koName, playerCode)));
      for (const appearance of found) if (appearance) appearances.push(appearance);
    }

    appearances.sort((a, b) => b.date.localeCompare(a.date));
    const uniqueAppearances = Array.from(new Map(appearances.map((item) => [`${item.date}|${item.opponent}|${item.side}`, item])).values());
    const recentItems = uniqueAppearances.slice(0, 10);
    const opponentItems = opponent ? uniqueAppearances.filter((item) => item.opponent === opponent.ko) : [];
    const stadiumItems = stadium
      ? uniqueAppearances.filter((item) => normalize(item.venue).includes(normalize(stadium)) || normalize(stadium).includes(normalize(item.venue)))
      : [];
    const homeItems = uniqueAppearances.filter((item) => item.side === "home");
    const awayItems = uniqueAppearances.filter((item) => item.side === "away");

    return NextResponse.json({
      success: true,
      source: "NPB 공식 경기별 박스스코어(선수 코드·헤더 기반 파싱)",
      parserVersion: "npb-pitcher-history-v6-starter-row-correct-team-order",
      pitcher: koName,
      recent10: { ...aggregate(recentItems), gamesDetail: recentItems },
      recent5: { ...aggregate(recentItems.slice(0, 5)), gamesDetail: recentItems.slice(0, 5) },
      opponent: aggregate(opponentItems),
      stadium: aggregate(stadiumItems),
      split: {
        home: aggregate(homeItems),
        away: aggregate(awayItems),
        summary: `홈 ${aggregate(homeItems).summary} / 원정 ${aggregate(awayItems).summary}`,
      },
    }, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "투수 경기별 기록 수집 오류",
    }, { status: 500 });
  }
}

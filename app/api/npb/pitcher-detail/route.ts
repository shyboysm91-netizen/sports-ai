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
  scoreUrl: string;
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


const SCORE_TEAM_CODES: Record<string, string> = {
  "요미우리 자이언츠": "g",
  "주니치 드래건스": "d",
  "요코하마 DeNA 베이스타스": "db",
  "도쿄 야쿠르트 스왈로스": "s",
  "히로시마 도요 카프": "c",
  "한신 타이거스": "t",
  "후쿠오카 소프트뱅크 호크스": "h",
  "지바 롯데 마린스": "m",
  "홋카이도 닛폰햄 파이터스": "f",
  "오릭스 버팔로스": "b",
  "도호쿠 라쿠텐 골든이글스": "e",
  "사이타마 세이부 라이온스": "l",
};

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
  const clean = (value: string) => value
    .replace(/\([^)]*\)/g, " ")
    .replace(/（[^）]*）/g, " ")
    .trim();
  const aa = normalize(clean(a));
  const bb = normalize(clean(b));
  if (!aa || !bb) return false;
  if (aa === bb) return true;

  // NPB 영문 박스스코어는 Mori, Y.Maeda처럼 성만 또는 이니셜+성으로 표시한다.
  // S.Mori / Shohei Mori / Mori를 모두 같은 선수로 인식하도록 영문 성을 비교한다.
  const latinSurname = (value: string) => {
    const tokens = clean(value).toLowerCase().replace(/[^a-z.\s,-]/g, " ")
      .split(/[\s,]+/).map((token) => token.replace(/\./g, "")).filter(Boolean);
    return tokens.length ? tokens[tokens.length - 1] : "";
  };
  const aSurname = latinSurname(a);
  const bSurname = latinSurname(b);
  if (aSurname && bSurname && aSurname === bSurname) return true;

  return aa.length >= 4 && bb.length >= 4 && (aa.endsWith(bb) || bb.endsWith(aa));
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
    const match = between.match(/^(\d{1,2})\s+Game\s+(\d+)\s+(.+?)\s+(\d{1,2})$/i);
    if (!match) continue;

    // NPB 일정 페이지는 첫 번째 팀이 홈, 두 번째 팀이 원정입니다.
    // 예: Hiroshima 2 Game 15 Mazda Stadium 4 Hanshin => 홈 Hiroshima / 원정 Hanshin
    const homeTeam = first.ko;
    const awayTeam = second.ko;
    const side: "home" | "away" = requestedTeam === homeTeam ? "home" : "away";
    const opponent = requestedTeam === homeTeam ? awayTeam : homeTeam;
    const href = anchor.href.startsWith("http")
      ? anchor.href
      : new URL(anchor.href, `https://npb.jp/bis/eng/${year}/games/`).toString();
    const gameNo = match[2];
    const homeCode = SCORE_TEAM_CODES[homeTeam] || "";
    const awayCode = SCORE_TEAM_CODES[awayTeam] || "";
    const scoreUrl = homeCode && awayCode
      ? `https://npb.jp/scores/${year}/${date.slice(5, 7)}${date.slice(8, 10)}/${homeCode}-${awayCode}-${gameNo}/box.html`
      : "";

    links.push({ url: href, scoreUrl, date, opponent, venue: venueKo(match[3]), side });
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

function parseModernScorePitchingRows(table: string): ParsedPitchingRow[] {
  const rawRows = table.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  const rows = rawRows.map((raw) => ({ raw, cells: tableCells(raw) }))
    .map(({ raw, cells }) => ({ raw, cells, texts: cells.map((cell) => cell.text.trim()) }));
  const headerRowIndex = rows.findIndex((row) => {
    const keys = row.texts.map(headerKey);
    return keys.includes("投手") && keys.includes("投球数") && keys.includes("打者")
      && keys.includes("投球回") && keys.includes("三振") && keys.includes("自責点");
  });
  if (headerRowIndex < 0) return [];

  const headers = rows[headerRowIndex].texts.map(headerKey);
  const pos = (aliases: string[]) => headerIndex(headers, aliases);
  const positions = {
    pitcher: pos(["投手"]),
    pitches: pos(["投球数", "球数"]),
    batters: pos(["打者", "対打者"]),
    innings: pos(["投球回", "回"]),
    hits: pos(["安打", "被安打"]),
    walks: pos(["四球", "与四球"]),
    hitByPitch: pos(["死球", "与死球"]),
    strikeouts: pos(["三振", "奪三振"]),
    runs: pos(["失点"]),
    earnedRuns: pos(["自責点", "自責"]),
  };

  const parsed: ParsedPitchingRow[] = [];
  for (const row of rows.slice(headerRowIndex + 1)) {
    if (row.texts.some((text) => /チーム計/.test(text))) break;
    const pitcherCell = row.cells[positions.pitcher];
    if (!pitcherCell) continue;
    const playerCode = pitcherCell.html.match(/\/players\/(\d+)\.html/i)?.[1]
      || pitcherCell.html.match(/\/bis\/(?:eng\/)?players\/(\d+)\.html/i)?.[1]
      || "";
    const rawName = pitcherCell.text.trim();
    if (!rawName || rawName === "投手") continue;
    const inningsOuts = parseInnings(row.texts[positions.innings] || "");
    if (inningsOuts <= 0 || inningsOuts > 36) continue;
    const decisionMark = row.texts[0]?.trim() || "";
    parsed.push({
      starterOriginalName: rawName,
      playerCode,
      inningsOuts,
      battersFaced: n(row.texts[positions.batters]),
      hits: n(row.texts[positions.hits]),
      walks: n(row.texts[positions.walks]),
      hitByPitch: n(row.texts[positions.hitByPitch]),
      strikeouts: n(row.texts[positions.strikeouts]),
      earnedRuns: n(row.texts[positions.earnedRuns]),
      runs: n(row.texts[positions.runs]),
      decision: /○|勝/.test(decisionMark) ? "승" : /●|敗/.test(decisionMark) ? "패" : "-",
      pitches: n(row.texts[positions.pitches]) || null,
    });
  }
  return parsed;
}

function parsePitchingRows(table: string): ParsedPitchingRow[] {
  const rawRows = table.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  const rows = rawRows.map((raw) => ({ raw, cells: tableCells(raw) }))
    .map(({ raw, cells }) => ({ raw, cells, texts: cells.map((cell) => cell.text.trim()).filter(Boolean) }))
    .filter((row) => row.texts.length > 0);
  if (!rows.length) return [];

  const isInningsHeader = (texts: string[]) => texts.some((text) => ["ip", "投球回", "回"].includes(headerKey(text)));
  const isStatsHeader = (texts: string[]) => {
    const keys = texts.map(headerKey);
    return keys.includes("bf") && keys.includes("h") && keys.includes("bb") && keys.includes("so") && keys.includes("er")
      || keys.some((key) => ["打者", "対打者"].includes(key))
        && keys.some((key) => ["被安打", "安打"].includes(key))
        && keys.some((key) => ["四球", "与四球"].includes(key))
        && keys.some((key) => ["三振", "奪三振"].includes(key))
        && keys.some((key) => ["自責点", "自責"].includes(key));
  };

  const numeric = (value: string) => /^-?(?:\d+(?:\.\d+)?|\.\d+|\d+\s+[12]\/3|[12]\/3)$/.test(value.trim());
  const parseOutsFromTokens = (tokens: string[]) => {
    if (!tokens.length) return { outs: 0, used: 0 };
    const first = tokens[0].trim();
    if (/^\d+$/.test(first) && tokens[1] && /^\.[12]$/.test(tokens[1].trim())) {
      return { outs: Number(first) * 3 + Number(tokens[1].trim().slice(1)), used: 2 };
    }
    const outs = parseInnings(first);
    return { outs, used: outs > 0 ? 1 : 0 };
  };

  const parsed: ParsedPitchingRow[] = [];
  let i = 0;
  while (i < rows.length) {
    if (!isInningsHeader(rows[i].texts)) { i += 1; continue; }

    let statsHeaderIndex = i + 1;
    while (statsHeaderIndex < rows.length && statsHeaderIndex <= i + 3 && !isStatsHeader(rows[statsHeaderIndex].texts)) {
      statsHeaderIndex += 1;
    }
    if (statsHeaderIndex >= rows.length || !isStatsHeader(rows[statsHeaderIndex].texts)) { i += 1; continue; }

    const statHeaders = rows[statsHeaderIndex].texts.map(headerKey);
    const statPos = (aliases: string[]) => statHeaders.findIndex((key) => aliases.map(headerKey).includes(key));
    const positions = {
      batters: statPos(["BF", "打者", "対打者"]),
      hits: statPos(["H", "被安打", "安打"]),
      walks: statPos(["BB", "四球", "与四球"]),
      hitByPitch: statPos(["HB", "HBP", "死球", "与死球"]),
      strikeouts: statPos(["SO", "K", "三振", "奪三振"]),
      runs: statPos(["R", "失点"]),
      earnedRuns: statPos(["ER", "自責点", "自責"]),
      pitches: statPos(["NP", "Pitches", "Pitch", "球数"]),
    };

    let rowIndex = statsHeaderIndex + 1;
    while (rowIndex < rows.length) {
      const current = rows[rowIndex];
      if (isInningsHeader(current.texts) || isStatsHeader(current.texts)) break;
      if (current.texts.length === 1 && /^[|｜]$/.test(current.texts[0])) { rowIndex += 1; continue; }

      const nameIndex = current.texts.findIndex((text) => !numeric(text) && !/^[|｜-]$/.test(text));
      if (nameIndex < 0) { rowIndex += 1; continue; }

      const rawName = current.texts[nameIndex];
      if (/^(pitcher|投手)$/i.test(rawName)) { rowIndex += 1; continue; }

      const afterName = current.texts.slice(nameIndex + 1);
      const inningsParsed = parseOutsFromTokens(afterName);
      if (inningsParsed.outs <= 0 || inningsParsed.outs > 36) { rowIndex += 1; continue; }

      let statValues = afterName.slice(inningsParsed.used).filter(numeric);
      let consumedNext = false;
      if (statValues.length < 6 && rows[rowIndex + 1]) {
        const nextTexts = rows[rowIndex + 1].texts.filter(numeric);
        if (nextTexts.length >= 6) {
          statValues = nextTexts;
          consumedNext = true;
        }
      }
      if (statValues.length < 6) { rowIndex += 1; continue; }

      const valueAt = (position: number) => position >= 0 ? (statValues[position] || "") : "";
      const decisionCode = rawName.match(/\((W|L|S|H)\)/i)?.[1]?.toUpperCase()
        || rawName.match(/(?:^|\s)(勝|敗)(?:\s|$)/)?.[1]
        || "";
      const playerCode = current.cells.map((cell) => cell.html).join(" ").match(/\/players\/(\d+)\.html/i)?.[1] || "";
      const pitchCount = n(valueAt(positions.pitches));

      parsed.push({
        starterOriginalName: rawName.replace(/\s*\((?:W|L|S|H)(?:[^)]*)\)\s*/gi, "").trim(),
        playerCode,
        inningsOuts: inningsParsed.outs,
        battersFaced: n(valueAt(positions.batters)),
        hits: n(valueAt(positions.hits)),
        walks: n(valueAt(positions.walks)),
        hitByPitch: n(valueAt(positions.hitByPitch)),
        strikeouts: n(valueAt(positions.strikeouts)),
        earnedRuns: n(valueAt(positions.earnedRuns)),
        runs: n(valueAt(positions.runs)),
        decision: decisionCode === "W" || decisionCode === "勝" ? "승" : decisionCode === "L" || decisionCode === "敗" ? "패" : "-",
        pitches: pitchCount > 0 ? pitchCount : null,
      });

      rowIndex += consumedNext ? 2 : 1;
    }
    i = Math.max(rowIndex, i + 1);
  }

  return parsed;
}



/**
 * NPB scores 페이지의 투수 행은 데스크톱/모바일용 중첩 표 때문에 일반적인
 * <tr><td> 파싱으로는 투구수·이닝과 나머지 통계가 갈라집니다.
 * 전체 HTML의 선수 링크를 기준점으로 삼고, 그 뒤에 연속해서 나오는 숫자 셀을
 * 원래 공식 헤더 순서대로 읽습니다.
 */
function parseScorePitcherByPlayerCode(html: string, requestedPlayerCode: string): ParsedPitchingRow | null {
  if (!html || !requestedPlayerCode) return null;

  const marked = html.replace(
    /<a\b([^>]*href=["'][^"']*\/bis\/players\/(\d+)\.html[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi,
    (_all, _attrs, code, label) => `\n@@NPB_PLAYER:${code}:${cleanHtml(label)}@@\n`,
  );

  const plain = marked
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:td|th|tr|table|tbody|thead|tfoot|div|p|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_all, code) => String.fromCharCode(Number(code)));

  const tokens = plain.split(/\r?\n/).map((value) => value.replace(/\s+/g, " ").trim()).filter(Boolean);
  const marker = new RegExp(`^@@NPB_PLAYER:${requestedPlayerCode.replace(/[^0-9]/g, "")}:([\\s\\S]*?)@@$`);
  const numericToken = /^-?(?:\d+(?:\.\d+)?|\.\d+|\d+\s+[12]\/3|[12]\/3)$/;

  for (let markerIndex = 0; markerIndex < tokens.length; markerIndex += 1) {
    const markerMatch = tokens[markerIndex].match(marker);
    if (!markerMatch) continue;

    const values: string[] = [];
    for (let index = markerIndex + 1; index < tokens.length && index <= markerIndex + 30; index += 1) {
      const token = tokens[index];
      if (/^@@NPB_PLAYER:/.test(token) || /チーム計/.test(token)) break;

      // 한 셀 안에 "0 .2"처럼 이닝이 둘로 표시되는 경우까지 분리한다.
      const pieces = token.match(/-?\d+(?:\.\d+)?|\.\d+|[12]\/3/g) || [];
      if (!pieces.length) {
        if (values.length > 0 && !/^[○●HS勝敗-]$/.test(token)) break;
        continue;
      }
      if (pieces.every((piece) => numericToken.test(piece))) values.push(...pieces);
      if (values.length >= 13) break;
    }

    // 투구수, 타자, 이닝, H, HR, BB, HBP, SO, WP, BK, R, ER
    if (values.length < 12) continue;
    const pitches = n(values[0]);
    const battersFaced = n(values[1]);
    let inningsValue = values[2];
    let statStart = 3;
    if (/^\d+$/.test(values[2]) && /^\.[12]$/.test(values[3] || "")) {
      inningsValue = `${values[2]}${values[3]}`;
      statStart = 4;
    }
    const inningsOuts = parseInnings(inningsValue);
    const stats = values.slice(statStart, statStart + 9).map(n);
    if (stats.length < 9) continue;
    const [hits, _homeRuns, walks, hitByPitch, strikeouts, _wildPitches, _balks, runs, earnedRuns] = stats;

    // 같은 선수 링크는 타격표에도 있으므로 투수 기록으로 가능한 값만 채택한다.
    if (pitches <= 0 || pitches > 250 || battersFaced <= 0 || battersFaced > 100) continue;
    if (inningsOuts <= 0 || inningsOuts > 36) continue;
    if ([hits, walks, hitByPitch, strikeouts, runs, earnedRuns].some((value) => value < 0 || value > 50)) continue;
    if (hits > battersFaced || walks > battersFaced || strikeouts > battersFaced || earnedRuns > runs) continue;

    const before = tokens.slice(Math.max(0, markerIndex - 3), markerIndex).join(" ");
    const decision = /○|勝/.test(before) ? "승" : /●|敗/.test(before) ? "패" : "-";

    return {
      starterOriginalName: markerMatch[1].trim(),
      playerCode: requestedPlayerCode,
      inningsOuts,
      battersFaced,
      hits,
      walks,
      hitByPitch,
      strikeouts,
      earnedRuns,
      runs,
      decision,
      pitches,
    };
  }

  return null;
}

function selectPitcherRow(table: string, originalName: string, koName: string, playerCode = "") {
  const rows = [...parseModernScorePitchingRows(table), ...parsePitchingRows(table)];
  if (!rows.length) return null;

  // MLB gameLog처럼 해당 선수의 경기 행만 사용한다. 팀 투수표 첫 행을 무조건
  // 가져오던 기존 방식 때문에 모든 날짜가 다른 선발투수의 기록으로 섞였다.
  if (playerCode) {
    const byCode = rows.find((row) => row.playerCode === playerCode);
    // 선수 코드가 전달된 경우에는 성(Mori, Maeda 등) 비교로 절대 내려가지 않는다.
    // 같은 성을 가진 다른 투수 기록이 섞이는 문제의 직접 원인이었다.
    return byCode ?? null;
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
  // 새 NPB 공식 score 페이지는 playerCode와 투구수를 같은 투수표에 제공한다.
  const scoreHtml = game.scoreUrl ? await getText(game.scoreUrl, 21600) : "";
  const englishHtml = await getText(game.url, 21600);
  if (!scoreHtml && !englishHtml) return null;

  let parsed: ReturnType<typeof selectPitcherRow> = null;
  // playerCode가 있으면 공식 scores HTML 전체에서 선수 링크 뒤 숫자 스트림을 직접 읽는다.
  // 타격표의 동일 선수 링크는 12개 연속 투수 통계가 없어 자동 제외된다.
  if (scoreHtml && playerCode) parsed = parseScorePitcherByPlayerCode(scoreHtml, playerCode);

  // 일본어 scores 페이지는 수치 기록은 정확하지만 일부 경기에서 승/패 표시가
  // 선수 숫자 스트림 주변에 포함되지 않는다. 같은 경기의 영문 박스스코어에는
  // 선수명 옆 (W)/(L)이 있으므로, 수치는 그대로 두고 판정만 보완한다.
  let englishDecision = "-";
  if (englishHtml) {
    const tables = pitchingTables(englishHtml);
    const preferredIndex = game.side === "away" ? 0 : 1;
    const orderedTables = [tables[preferredIndex], ...tables.filter((_, index) => index !== preferredIndex)].filter(Boolean);
    for (const table of orderedTables) {
      const candidate = selectPitcherRow(table, originalName, koName, playerCode);
      if (!candidate) continue;
      if (candidate.decision === "승" || candidate.decision === "패") englishDecision = candidate.decision;
      if (!parsed) parsed = candidate;
      break;
    }
  }

  // scores 페이지에서 이미 수치를 찾았다면 영문 페이지는 승패만 합친다.
  if (parsed && parsed.decision === "-" && englishDecision !== "-") {
    parsed = { ...parsed, decision: englishDecision };
  }

  // scores/영문 어느 쪽에서도 아직 선수를 못 찾았을 때만 기존 표 파서를 사용한다.
  if (!parsed && scoreHtml) {
    const tables = pitchingTables(scoreHtml);
    const preferredIndex = game.side === "away" ? 0 : 1;
    const orderedTables = [tables[preferredIndex], ...tables.filter((_, index) => index !== preferredIndex)].filter(Boolean);
    for (const table of orderedTables) {
      parsed = selectPitcherRow(table, originalName, koName, playerCode);
      if (parsed) break;
    }
  }
  // 해당 투수가 실제로 등판하지 않은 경기는 최근 등판 기록에 넣지 않는다.
  if (!parsed) return null;

  const innings = parsed.inningsOuts / 3;
  return {
    ...game,
    inningsOuts: parsed.inningsOuts,
    innings: outsToInnings(parsed.inningsOuts),
    hits: parsed.hits,
    walks: parsed.walks,
    hitByPitch: parsed.hitByPitch,
    strikeouts: parsed.strikeouts,
    earnedRuns: parsed.earnedRuns,
    era: innings ? parsed.earnedRuns * 9 / innings : 0,
    decision: parsed.decision,
    pitches: parsed.pitches,
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
      source: "NPB 공식 scores 경기별 박스스코어(playerCode·투구수 기반)",
      parserVersion: "npb-pitcher-history-v22-decision-english-fallback",
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

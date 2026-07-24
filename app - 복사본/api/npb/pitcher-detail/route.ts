import { NextResponse } from "next/server";
import { cleanHtml, findTeam, inningsToOuts, outsToInnings, playerNameKo, tableRows } from "../_shared";

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

    const homeTeam = first.ko;
    const awayTeam = second.ko;
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

function parsePitcherRow(cells: string[], requestedOriginal: string, requestedKo: string) {
  // NPB 공식 박스스코어의 투수 행은 한쪽 또는 양쪽 팀 기록이 같은 행에 함께 들어올 수 있다.
  // 이름 뒤의 IP, BF, H, BB, HB, SO, ER 7개 숫자를 유연하게 찾는다.
  for (let index = 0; index < cells.length; index++) {
    const rawName = cells[index].replace(/\s*\((?:W|L|S|H)\)\s*/gi, "").trim();
    if (!samePitcher(rawName, requestedOriginal) && !samePitcher(playerNameKo(rawName), requestedKo)) continue;

    const stats = cells.slice(index + 1, index + 10);
    if (stats.length < 7) continue;
    const ip = stats[0];
    if (!/^\d+(?:\.[012])?$/.test(ip)) continue;

    return {
      inningsOuts: inningsToOuts(ip),
      hits: n(stats[2]),
      walks: n(stats[3]),
      hitByPitch: n(stats[4]),
      strikeouts: n(stats[5]),
      earnedRuns: n(stats[6]),
    };
  }
  return null;
}

async function getText(url: string, revalidate: number) {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
    next: { revalidate },
  });
  return response.ok ? response.text() : "";
}

async function appearanceFromGame(game: GameLink, originalName: string, koName: string): Promise<Appearance | null> {
  const html = await getText(game.url, 21600);
  if (!html) return null;

  for (const row of tableRows(html)) {
    const parsed = parsePitcherRow(row, originalName, koName);
    if (!parsed) continue;
    const innings = parsed.inningsOuts / 3;
    return {
      ...game,
      ...parsed,
      innings: outsToInnings(parsed.inningsOuts),
      era: innings ? parsed.earnedRuns * 9 / innings : 0,
    };
  }
  return null;
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
  const stadium = query.get("stadium") || "";
  const endText = query.get("date") || kstDate(new Date());

  if (!team || !originalName) {
    return NextResponse.json({ success: false, message: "팀 또는 투수 이름이 없습니다." }, { status: 400 });
  }

  try {
    const end = new Date(`${endText}T12:00:00+09:00`);
    const dates = Array.from({ length: 420 }, (_, index) => {
      const target = new Date(end);
      target.setDate(target.getDate() - index - 1);
      return kstDate(target);
    });

    const appearances: Appearance[] = [];

    for (let offset = 0; offset < dates.length && appearances.length < 30; offset += 10) {
      const batchDates = dates.slice(offset, offset + 10);
      const schedules = await Promise.all(batchDates.map(async (date) => {
        const year = date.slice(0, 4);
        const html = await getText(`https://npb.jp/bis/eng/${year}/games/gm${date.replaceAll("-", "")}.html`, 21600);
        return html ? parseGameLinks(html, date, team.ko) : [];
      }));

      const gameLinks = schedules.flat();
      for (const game of gameLinks) {
        const appearance = await appearanceFromGame(game, originalName, koName);
        if (appearance) appearances.push(appearance);
      }
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
      source: "NPB 공식 경기별 박스스코어",
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

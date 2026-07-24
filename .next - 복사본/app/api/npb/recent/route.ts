import { NextResponse } from "next/server";
import { cleanHtml, findTeam } from "../_shared";

type Game = {
  date: string;
  opponent: string;
  result: "승" | "패" | "무";
  runsFor: number;
  runsAgainst: number;
  score: string;
};

type TeamAlias = { ko: string; aliases: string[] };

const TEAMS: TeamAlias[] = [
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

function kstIsoDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function findAliases(text: string) {
  const lower = text.toLowerCase();
  const found: Array<{ ko: string; alias: string; index: number }> = [];

  for (const team of TEAMS) {
    const matches = team.aliases
      .map((alias) => ({ alias, index: lower.indexOf(alias.toLowerCase()) }))
      .filter((item) => item.index >= 0)
      .sort((a, b) => a.index - b.index || b.alias.length - a.alias.length);
    if (matches[0]) found.push({ ko: team.ko, ...matches[0] });
  }

  return found.sort((a, b) => a.index - b.index);
}

function firstNumber(text: string) {
  const match = text.match(/(?:^|\s)(\d{1,2})(?=\s|$)/);
  return match ? Number(match[1]) : null;
}

function lastNumber(text: string) {
  const matches = [...text.matchAll(/(?:^|\s)(\d{1,2})(?=\s|$)/g)];
  return matches.length ? Number(matches[matches.length - 1][1]) : null;
}

function parseGameText(
  rawText: string,
  requestedTeam: string,
  opponentFilter: string | null,
  date: string,
): Game | null {
  const text = cleanHtml(rawText);
  const teams = findAliases(text);
  if (teams.length !== 2) return null;

  const first = teams[0];
  const second = teams[1];
  if (first.ko !== requestedTeam && second.ko !== requestedTeam) return null;

  const opponent = first.ko === requestedTeam ? second.ko : first.ko;
  if (opponentFilter && opponent !== opponentFilter) return null;

  const afterFirst = text.slice(first.index + first.alias.length, second.index);
  const beforeSecond = text.slice(first.index + first.alias.length, second.index);
  const firstScore = firstNumber(afterFirst);
  const secondScore = lastNumber(beforeSecond);
  if (firstScore === null || secondScore === null) return null;

  const runsFor = first.ko === requestedTeam ? firstScore : secondScore;
  const runsAgainst = first.ko === requestedTeam ? secondScore : firstScore;
  const result: Game["result"] =
    runsFor > runsAgainst ? "승" : runsFor < runsAgainst ? "패" : "무";

  return {
    date,
    opponent,
    result,
    runsFor,
    runsAgainst,
    score: `${runsFor}-${runsAgainst}`,
  };
}

function gameTexts(html: string) {
  const anchors = html.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) ?? [];
  const texts = anchors.map(cleanHtml).filter((text) => {
    const teams = findAliases(text);
    return teams.length === 2 && /\bGame\b/i.test(text);
  });
  return [...new Set(texts)];
}

async function gamesForDate(
  date: string,
  requestedTeam: string,
  opponent: string | null,
) {
  const year = date.slice(0, 4);
  const response = await fetch(
    `https://npb.jp/bis/eng/${year}/games/gm${date.replaceAll("-", "")}.html`,
    {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
      next: { revalidate: 1800 },
    },
  );
  if (!response.ok) return [] as Game[];

  const html = await response.text();
  return gameTexts(html)
    .map((text) => parseGameText(text, requestedTeam, opponent, date))
    .filter((game): game is Game => Boolean(game));
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const team = findTeam(query.get("team") ?? "");
  const opponent = query.get("opponent")
    ? findTeam(query.get("opponent")!)
    : null;
  const limit = Math.min(10, Math.max(1, Number(query.get("limit") || 10)));
  const endDateText = query.get("date") || kstIsoDate(new Date());

  if (!team) {
    return NextResponse.json(
      { success: false, message: "NPB 팀을 찾지 못했습니다." },
      { status: 400 },
    );
  }

  try {
    const endDate = new Date(`${endDateText}T12:00:00+09:00`);
    const searchDays = opponent ? 220 : 55;
    const dates = Array.from({ length: searchDays }, (_, index) => {
      const target = new Date(endDate);
      target.setDate(target.getDate() - index - 1);
      return kstIsoDate(target);
    });

    const collected: Game[] = [];
    for (let index = 0; index < dates.length && collected.length < limit; index += 8) {
      const batch = await Promise.all(
        dates
          .slice(index, index + 8)
          .map((date) => gamesForDate(date, team.ko, opponent?.ko ?? null)),
      );
      collected.push(...batch.flat());
    }

    const unique = new Map<string, Game>();
    for (const game of collected) {
      unique.set(`${game.date}-${game.opponent}-${game.score}`, game);
    }

    const games = [...unique.values()]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
    const wins = games.filter((game) => game.result === "승").length;
    const losses = games.filter((game) => game.result === "패").length;
    const draws = games.filter((game) => game.result === "무").length;
    const runsFor = games.reduce((sum, game) => sum + game.runsFor, 0);
    const runsAgainst = games.reduce((sum, game) => sum + game.runsAgainst, 0);

    return NextResponse.json({
      success: true,
      source: "NPB 공식 경기 결과",
      team: team.ko,
      opponent: opponent?.ko ?? null,
      games,
      summary: {
        games: games.length,
        wins,
        losses,
        draws,
        runsFor,
        runsAgainst,
        averageRunsFor: games.length ? runsFor / games.length : 0,
        averageRunsAgainst: games.length ? runsAgainst / games.length : 0,
        winRate: wins + losses ? wins / (wins + losses) : 0.5,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "NPB 최근 경기 오류",
      },
      { status: 500 },
    );
  }
}

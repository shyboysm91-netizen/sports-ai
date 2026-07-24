import { NextResponse } from "next/server";
import { findTeam, num, playerNameKo, tableRows } from "../_shared";

type Batter = {
  name: string;
  originalName: string;
  games: number;
  plateAppearances: number;
  atBats: number;
  runs: number;
  hits: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  totalBases: number;
  rbi: number;
  steals: number;
  walks: number;
  hitByPitch: number;
  strikeouts: number;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

const responseHeaders = {
  "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
};

function isIntegerCell(value: string | undefined) {
  return /^-?\d+$/.test((value ?? "").replace(/,/g, "").trim());
}

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const teamName = q.get("team") ?? "";
  const requestedSeason = q.get("season") ?? "";
  const season = /^\d{4}$/.test(requestedSeason)
    ? requestedSeason
    : String(new Date().getFullYear());
  const team = findTeam(teamName);

  if (!team) {
    return NextResponse.json(
      { success: false, message: "NPB 팀을 찾지 못했습니다." },
      { status: 400, headers: responseHeaders },
    );
  }

  try {
    const sourceUrl = `https://npb.jp/bis/eng/${season}/stats/idb1_${team.code}.html`;
    const response = await fetch(sourceUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      next: { revalidate: 1800 },
    });

    if (!response.ok) {
      throw new Error(`NPB 타격 기록 요청 실패: ${response.status}`);
    }

    const html = await response.text();
    const players: Batter[] = [];

    for (const row of tableRows(html)) {
      // NPB 영문 공식표: Player + G PA AB R H 2B 3B HR TB RBI SB CS SH SF BB IBB HP SO GDP AVG SLG OBP
      const nameIndex = row.findIndex(
        (cell, index) => index < 4 && /,/.test(cell) && /[A-Za-z]/.test(cell),
      );
      if (nameIndex < 0) continue;

      const originalName = row[nameIndex].replace(/^[*+]/, "").trim();
      const stats = row.slice(nameIndex + 1);

      // Player 뒤에는 정확히 22개 통계 열이 존재한다. 기존 코드는 23개를 요구해 전 선수를 누락했다.
      if (stats.length < 22) continue;
      if (!isIntegerCell(stats[0]) || !isIntegerCell(stats[1]) || !isIntegerCell(stats[2])) {
        continue;
      }

      players.push({
        name: playerNameKo(originalName),
        originalName,
        games: num(stats[0]),
        plateAppearances: num(stats[1]),
        atBats: num(stats[2]),
        runs: num(stats[3]),
        hits: num(stats[4]),
        doubles: num(stats[5]),
        triples: num(stats[6]),
        homeRuns: num(stats[7]),
        totalBases: num(stats[8]),
        rbi: num(stats[9]),
        steals: num(stats[10]),
        walks: num(stats[14]),
        hitByPitch: num(stats[16]),
        strikeouts: num(stats[17]),
      });
    }

    // 파싱 실패를 0.000이라는 정상 데이터처럼 반환하지 않는다.
    if (players.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "NPB 공식 타격표를 읽지 못했습니다. 잘못된 0 기록은 표시하지 않습니다.",
          season,
          team: team.ko,
          stats: null,
          source: "NPB 공식 팀별 선수 타격 기록",
          sourceUrl,
        },
        { status: 502, headers: responseHeaders },
      );
    }

    const totals = players.reduce(
      (a, p) => ({
        games: Math.max(a.games, p.games),
        plateAppearances: a.plateAppearances + p.plateAppearances,
        atBats: a.atBats + p.atBats,
        runs: a.runs + p.runs,
        hits: a.hits + p.hits,
        doubles: a.doubles + p.doubles,
        triples: a.triples + p.triples,
        homeRuns: a.homeRuns + p.homeRuns,
        totalBases: a.totalBases + p.totalBases,
        rbi: a.rbi + p.rbi,
        steals: a.steals + p.steals,
        walks: a.walks + p.walks,
        hitByPitch: a.hitByPitch + p.hitByPitch,
        strikeouts: a.strikeouts + p.strikeouts,
      }),
      {
        games: 0,
        plateAppearances: 0,
        atBats: 0,
        runs: 0,
        hits: 0,
        doubles: 0,
        triples: 0,
        homeRuns: 0,
        totalBases: 0,
        rbi: 0,
        steals: 0,
        walks: 0,
        hitByPitch: 0,
        strikeouts: 0,
      },
    );

    if (totals.atBats <= 0 || totals.plateAppearances <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "타격표 선수는 확인했지만 유효 타석 데이터가 없습니다.",
          season,
          team: team.ko,
          stats: null,
          playerCount: players.length,
        },
        { status: 502, headers: responseHeaders },
      );
    }

    const average = totals.hits / totals.atBats;
    const sluggingPercentage = totals.totalBases / totals.atBats;
    const obpDenominator =
      totals.atBats + totals.walks + totals.hitByPitch;
    const onBasePercentage = obpDenominator
      ? (totals.hits + totals.walks + totals.hitByPitch) / obpDenominator
      : 0;

    return NextResponse.json(
      {
        success: true,
        version: "NPB-team-batting-v4",
        source: "NPB 공식 팀별 선수 타격 기록",
        sourceUrl,
        season,
        team: team.ko,
        playerCount: players.length,
        stats: {
          ...totals,
          average,
          onBasePercentage,
          sluggingPercentage,
          ops: onBasePercentage + sluggingPercentage,
        },
        leaders: {
          average: [...players]
            .filter((p) => p.atBats >= 30)
            .sort((a, b) => b.hits / b.atBats - a.hits / a.atBats)
            .slice(0, 3)
            .map((p) => ({ name: p.name, value: p.hits / p.atBats })),
          homeRuns: [...players]
            .sort((a, b) => b.homeRuns - a.homeRuns)
            .slice(0, 3)
            .map((p) => ({ name: p.name, value: p.homeRuns })),
          rbi: [...players]
            .sort((a, b) => b.rbi - a.rbi)
            .slice(0, 3)
            .map((p) => ({ name: p.name, value: p.rbi })),
        },
      },
      { headers: responseHeaders },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "NPB 타격 기록 오류",
        stats: null,
      },
      { status: 500, headers: responseHeaders },
    );
  }
}

import { NextResponse } from "next/server";
import { findTeam, num, playerNameKo, tableRows } from "../_shared";

type Batter = {
  name: string; originalName: string; games: number; plateAppearances: number; atBats: number;
  runs: number; hits: number; doubles: number; triples: number; homeRuns: number;
  totalBases: number; rbi: number; steals: number; sacrificeFlies: number;
  walks: number; hitByPitch: number; strikeouts: number;
};

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const teamName = q.get("team") ?? "";
  const season = /^\d{4}$/.test(q.get("season") ?? "") ? q.get("season")! : String(new Date().getFullYear());
  const team = findTeam(teamName);
  if (!team) return NextResponse.json({ success: false, message: "NPB 팀을 찾지 못했습니다." }, { status: 400 });

  try {
    const url = `https://npb.jp/bis/eng/${season}/stats/idb1_${team.code}.html`;
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" }, cache: "no-store" });
    if (!response.ok) throw new Error(`NPB 타격 기록 요청 실패: ${response.status}`);
    const rows = tableRows(await response.text());
    const players: Batter[] = [];

    // 공식 열: Player G PA AB R H 2B 3B HR TB RBI SB CS SH SF BB IBB HP SO GDP AVG SLG OBP
    for (const c of rows) {
      if (c.length < 24 || !/[A-Za-z]/.test(c[0]) || !/^\d+$/.test(c[1] ?? "")) continue;
      const originalName = c[0].replace(/^[*+]/, "").trim();
      players.push({
        name: playerNameKo(originalName), originalName,
        games: num(c[1]), plateAppearances: num(c[2]), atBats: num(c[3]), runs: num(c[4]), hits: num(c[5]),
        doubles: num(c[6]), triples: num(c[7]), homeRuns: num(c[8]), totalBases: num(c[9]), rbi: num(c[10]),
        steals: num(c[11]), sacrificeFlies: num(c[14]), walks: num(c[15]), hitByPitch: num(c[17]), strikeouts: num(c[18]),
      });
    }

    const totals = players.reduce((a, p) => ({
      games: Math.max(a.games, p.games), plateAppearances: a.plateAppearances + p.plateAppearances,
      atBats: a.atBats + p.atBats, runs: a.runs + p.runs, hits: a.hits + p.hits,
      doubles: a.doubles + p.doubles, triples: a.triples + p.triples, homeRuns: a.homeRuns + p.homeRuns,
      totalBases: a.totalBases + p.totalBases, rbi: a.rbi + p.rbi, steals: a.steals + p.steals,
      sacrificeFlies: a.sacrificeFlies + p.sacrificeFlies, walks: a.walks + p.walks,
      hitByPitch: a.hitByPitch + p.hitByPitch, strikeouts: a.strikeouts + p.strikeouts,
    }), { games: 0, plateAppearances: 0, atBats: 0, runs: 0, hits: 0, doubles: 0, triples: 0, homeRuns: 0, totalBases: 0, rbi: 0, steals: 0, sacrificeFlies: 0, walks: 0, hitByPitch: 0, strikeouts: 0 });

    const average = totals.atBats ? totals.hits / totals.atBats : 0;
    const sluggingPercentage = totals.atBats ? totals.totalBases / totals.atBats : 0;
    const obpDen = totals.atBats + totals.walks + totals.hitByPitch + totals.sacrificeFlies;
    const onBasePercentage = obpDen ? (totals.hits + totals.walks + totals.hitByPitch) / obpDen : 0;

    return NextResponse.json({
      success: true, source: "NPB 공식 팀별 선수 타격 기록", season, team: team.ko,
      stats: { ...totals, average, onBasePercentage, sluggingPercentage, ops: onBasePercentage + sluggingPercentage },
      leaders: {
        average: [...players].filter(p => p.atBats >= 30).sort((a,b) => b.hits/b.atBats - a.hits/a.atBats).slice(0,3).map(p => ({ name:p.name, value:p.hits/p.atBats })),
        homeRuns: [...players].sort((a,b)=>b.homeRuns-a.homeRuns).slice(0,3).map(p=>({name:p.name,value:p.homeRuns})),
        rbi:[...players].sort((a,b)=>b.rbi-a.rbi).slice(0,3).map(p=>({name:p.name,value:p.rbi})),
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "NPB 타격 기록 오류" }, { status: 500 });
  }
}

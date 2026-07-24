import { NextResponse } from "next/server";

type Standing = {
  team: string;
  rank: number;
  wins: number;
  losses: number;
  draws: number;
  winningPercentage: number;
  home: string;
  away: string;
};

type Batting = {
  average: number;
  onBasePercentage: number;
  sluggingPercentage: number;
  ops: number;
  homeRuns: number;
  walks: number;
  strikeouts: number;
  runs: number;
  games: number;
};

type Pitching = { era: number; whip: number };
type PitcherRow = { name?: string; originalName?: string; [key: string]: unknown };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function splitRate(value: string | undefined) {
  const match = (value ?? "").match(/(\d+)-(\d+)/);
  if (!match) return 0.5;
  const wins = Number(match[1]);
  const losses = Number(match[2]);
  return wins + losses ? wins / (wins + losses) : 0.5;
}

async function json(origin: string, path: string) {
  const response = await fetch(`${origin}${path}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} 요청 실패 (${response.status})`);
  return response.json();
}

function findStarter(rotation: PitcherRow[], requestedName: string) {
  const wanted = requestedName.trim();
  if (!wanted) return rotation[0] ?? null;
  return (
    rotation.find((row) => row.name === wanted || row.originalName === wanted) ??
    rotation.find((row) =>
      String(row.name ?? "").includes(wanted) || wanted.includes(String(row.name ?? "")),
    ) ??
    rotation[0] ??
    null
  );
}

async function pitcherDetail(
  origin: string,
  team: string,
  opponent: string,
  requestedName: string,
  rotation: PitcherRow[],
  stadium: string,
  date: string,
) {
  const starter = findStarter(rotation, requestedName);
  if (!starter) return null;

  const originalName = String(starter.originalName ?? requestedName ?? starter.name ?? "");
  const name = String(starter.name ?? requestedName ?? originalName);
  if (!originalName) return null;

  try {
    const params = new URLSearchParams({
      team,
      opponent,
      originalName,
      name,
      stadium,
      date,
    });
    const detail = await json(origin, `/api/npb/pitcher-detail?${params.toString()}`);
    return detail?.success ? detail : null;
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams;
    const away = query.get("away") || "원정팀";
    const home = query.get("home") || "홈팀";
    const date = query.get("date") || String(new Date().getFullYear());
    const season = date.slice(0, 4);
    const stadium = query.get("stadium") || "";
    const requestedAwayStarter = query.get("awayStarter") || "";
    const requestedHomeStarter = query.get("homeStarter") || "";

    const [standings, awayBat, homeBat, awayPit, homePit] = await Promise.all([
      json(url.origin, "/api/npb/standings"),
      json(url.origin, `/api/npb/team-stats?team=${encodeURIComponent(away)}&season=${season}`),
      json(url.origin, `/api/npb/team-stats?team=${encodeURIComponent(home)}&season=${season}`),
      json(url.origin, `/api/npb/pitchers?team=${encodeURIComponent(away)}&season=${season}`),
      json(url.origin, `/api/npb/pitchers?team=${encodeURIComponent(home)}&season=${season}`),
    ]);

    const awayRotation: PitcherRow[] = awayPit.rotation ?? [];
    const homeRotation: PitcherRow[] = homePit.rotation ?? [];

    const [awayStarterDetail, homeStarterDetail] = await Promise.all([
      pitcherDetail(url.origin, away, home, requestedAwayStarter, awayRotation, stadium, date),
      pitcherDetail(url.origin, home, away, requestedHomeStarter, homeRotation, stadium, date),
    ]);

    const awayStanding: Standing | undefined = standings.standings?.find(
      (row: Standing) => row.team === away,
    );
    const homeStanding: Standing | undefined = standings.standings?.find(
      (row: Standing) => row.team === home,
    );
    const awayBatting: Batting | undefined = awayBat.stats;
    const homeBatting: Batting | undefined = homeBat.stats;
    const awayPitching: Pitching | undefined = awayPit.teamPitching;
    const homePitching: Pitching | undefined = homePit.teamPitching;

    const seasonEdge =
      ((homeStanding?.winningPercentage ?? 0.5) -
        (awayStanding?.winningPercentage ?? 0.5)) *
      34;
    const battingEdge =
      ((homeBatting?.ops ?? 0.65) - (awayBatting?.ops ?? 0.65)) * 42;
    const pitchingEdge =
      ((awayPitching?.era ?? 3.5) - (homePitching?.era ?? 3.5)) * 2.8;
    const homeForm =
      (splitRate(homeStanding?.home) - splitRate(awayStanding?.away)) * 13;
    const homeAdvantage = 3;
    const homeProbability = Math.round(
      clamp(
        50 + seasonEdge + battingEdge + pitchingEdge + homeForm + homeAdvantage,
        25,
        75,
      ),
    );
    const pick = homeProbability >= 50 ? home : away;
    const confidence = Math.round(
      clamp(54 + Math.abs(homeProbability - 50) * 1.25, 54, 88),
    );

    return NextResponse.json(
      {
        success: true,
        awayStanding: awayStanding ?? null,
        homeStanding: homeStanding ?? null,
        awayBatting: awayBatting ?? null,
        homeBatting: homeBatting ?? null,
        awayPitching: awayPitching ?? null,
        homePitching: homePitching ?? null,
        awayRotation,
        homeRotation,
        awayStarterDetail,
        homeStarterDetail,
        awayBullpen: awayPit.bullpen ?? [],
        homeBullpen: homePit.bullpen ?? [],
        probability: { away: 100 - homeProbability, home: homeProbability },
        pick,
        confidence,
        scores: {
          season: Math.round(seasonEdge * 10) / 10,
          batting: Math.round(battingEdge * 10) / 10,
          pitching: Math.round(pitchingEdge * 10) / 10,
          homeAway: Math.round((homeForm + homeAdvantage) * 10) / 10,
        },
        reasons: [
          `${pick}이 시즌 승률·타선 OPS·팀 투수력 종합 점수에서 우세합니다.`,
          homeBatting && awayBatting
            ? `팀 OPS는 ${away} ${awayBatting.ops.toFixed(3)}, ${home} ${homeBatting.ops.toFixed(3)}입니다.`
            : "팀 타격 기록 일부를 불러오지 못했습니다.",
          homePitching && awayPitching
            ? `팀 평균자책점은 ${away} ${awayPitching.era.toFixed(2)}, ${home} ${homePitching.era.toFixed(2)}입니다.`
            : "팀 투수 기록 일부를 불러오지 못했습니다.",
        ],
      },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "분석 오류",
      },
      { status: 500 },
    );
  }
}

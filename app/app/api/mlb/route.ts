import { NextResponse } from "next/server";
import { MLB_TEAM_KO_BY_ID, MLB_VENUE_KO, playerNameKo } from "../../lib/mlb-ko";

type MlbTeam = { id?: number; name?: string };
type MlbPerson = { id?: number; fullName?: string };
type MlbGame = {
  gamePk?: number;
  gameDate?: string;
  status?: { detailedState?: string; abstractGameState?: string };
  venue?: { name?: string };
  teams?: {
    away?: { team?: MlbTeam; probablePitcher?: MlbPerson };
    home?: { team?: MlbTeam; probablePitcher?: MlbPerson };
  };
};
type SchedulePayload = { dates?: Array<{ games?: MlbGame[] }> };

type GameResponse = {
  league: "MLB";
  gamePk: number;
  date: string;
  time: string;
  commenceTime: string;
  away: string;
  home: string;
  awayApiName: string;
  homeApiName: string;
  awayTeamId: number;
  homeTeamId: number;
  stadium: string;
  awayStarter: string;
  homeStarter: string;
  awayStarterCode: string;
  homeStarterCode: string;
  status: string;
};

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00+09:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function kstParts(iso: string) {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${read("year")}-${read("month")}-${read("day")}`,
    time: `${read("hour")}:${read("minute")}`,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  if (!validDate(date)) {
    return NextResponse.json({ success: false, games: [], message: "날짜 형식은 YYYY-MM-DD여야 합니다." }, { status: 400 });
  }

  try {
    const params = new URLSearchParams({
      sportId: "1",
      startDate: shiftDate(date, -1),
      endDate: shiftDate(date, 1),
      hydrate: "probablePitcher,team,venue",
    });
    const response = await fetch(`https://statsapi.mlb.com/api/v1/schedule?${params.toString()}`, {
      headers: { Accept: "application/json", "User-Agent": "Sports-AI/1.0" },
      next: { revalidate: 300 },
    });
    if (!response.ok) throw new Error(`MLB 일정 요청 실패: ${response.status}`);

    const payload = (await response.json()) as SchedulePayload;
    const games: GameResponse[] = [];
    for (const dateGroup of payload.dates ?? []) {
      for (const game of dateGroup.games ?? []) {
        if (!game.gamePk || !game.gameDate) continue;
        const kst = kstParts(game.gameDate);
        if (kst.date !== date) continue;
        games.push({
          league: "MLB",
          gamePk: game.gamePk,
          date: kst.date,
          time: kst.time,
          commenceTime: game.gameDate,
          away: MLB_TEAM_KO_BY_ID[game.teams?.away?.team?.id ?? 0] ?? game.teams?.away?.team?.name ?? "원정팀",
          home: MLB_TEAM_KO_BY_ID[game.teams?.home?.team?.id ?? 0] ?? game.teams?.home?.team?.name ?? "홈팀",
          awayApiName: game.teams?.away?.team?.name ?? "",
          homeApiName: game.teams?.home?.team?.name ?? "",
          awayTeamId: game.teams?.away?.team?.id ?? 0,
          homeTeamId: game.teams?.home?.team?.id ?? 0,
          stadium: MLB_VENUE_KO[game.venue?.name ?? ""] ?? game.venue?.name ?? "",
          awayStarter: playerNameKo(game.teams?.away?.probablePitcher?.fullName ?? ""),
          homeStarter: playerNameKo(game.teams?.home?.probablePitcher?.fullName ?? ""),
          awayStarterCode: String(game.teams?.away?.probablePitcher?.id ?? ""),
          homeStarterCode: String(game.teams?.home?.probablePitcher?.id ?? ""),
          status: game.status?.detailedState ?? game.status?.abstractGameState ?? "Scheduled",
        });
      }
    }
    games.sort((a, b) => a.commenceTime.localeCompare(b.commenceTime));
    return NextResponse.json({ success: true, source: "MLB Stats API", date, count: games.length, games });
  } catch (error) {
    return NextResponse.json({
      success: false,
      games: [],
      message: error instanceof Error ? error.message : "MLB 경기 일정을 불러오지 못했습니다.",
    }, { status: 500 });
  }
}

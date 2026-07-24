import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type League = "KBO" | "NPB" | "MLB";
type PredictionRow = {
  id: number;
  league: League;
  game_date: string;
  away_team: string;
  home_team: string;
  predicted_winner: string | null;
  result: string | null;
};

type AnyGame = Record<string, unknown>;

function getConfig() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  return { url, key: process.env.SUPABASE_SERVICE_ROLE_KEY || "" };
}

function headers(key: string, extra: Record<string, string> = {}) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s.·_\-()]/g, "")
    .replace(/(야구단|베이스볼클럽|baseballclub|club)$/g, "")
    .trim();
}

function firstText(game: AnyGame, keys: string[]) {
  for (const key of keys) {
    const value = game[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function firstNumber(game: AnyGame, keys: string[]) {
  for (const key of keys) {
    const value = game[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function gameTeams(game: AnyGame) {
  return {
    away: firstText(game, ["away", "awayTeam", "away_team", "visitor", "visitorTeam"]),
    home: firstText(game, ["home", "homeTeam", "home_team"]),
  };
}

function gameScores(game: AnyGame) {
  return {
    away: firstNumber(game, ["awayScore", "away_score", "visitorScore", "visitor_score", "scoreAway"]),
    home: firstNumber(game, ["homeScore", "home_score", "scoreHome"]),
  };
}

function isFinal(game: AnyGame) {
  if (game.completed === true || game.final === true || game.isFinal === true) return true;
  const status = firstText(game, ["status", "state", "gameStatus", "abstractGameState", "detailedState"]);
  return /final|completed|game\s*over|종료|경기종료|종료됨|끝/i.test(status);
}

function resultOf(row: PredictionRow, awayScore: number, homeScore: number) {
  if (awayScore === homeScore) return "draw";
  const winner = awayScore > homeScore ? row.away_team : row.home_team;
  return normalize(winner) === normalize(row.predicted_winner) ? "hit" : "miss";
}

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET || "";
  const bearer = Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
  const admin = request.headers.get("x-admin-password") === "2580";
  return bearer || admin;
}

function extractGames(payload: unknown): AnyGame[] {
  if (Array.isArray(payload)) return payload.filter((item): item is AnyGame => Boolean(item && typeof item === "object"));
  if (!payload || typeof payload !== "object") return [];
  const object = payload as Record<string, unknown>;
  for (const key of ["games", "data", "schedule", "matches"]) {
    const value = object[key];
    if (Array.isArray(value)) return value.filter((item): item is AnyGame => Boolean(item && typeof item === "object"));
  }
  return [];
}

async function loadSchedule(origin: string, league: League, date: string, authorization: string | null) {
  const path = `/api/${league.toLowerCase()}?date=${encodeURIComponent(date)}`;
  const cacheUrl = `${origin}/api/data-cache?path=${encodeURIComponent(path)}&ttl=300&refresh=1`;
  const response = await fetch(cacheUrl, {
    headers: authorization ? { Authorization: authorization } : undefined,
    cache: "no-store",
  });
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("application/json")) {
    const detail = await response.text().catch(() => "");
    throw new Error(`일정 API 오류 ${response.status}${detail ? `: ${detail.slice(0, 120)}` : ""}`);
  }
  return extractGames(await response.json());
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ success: false, message: "인증 실패" }, { status: 401 });
  }

  const { url, key } = getConfig();
  if (!url || !key) {
    return NextResponse.json({ success: false, message: "Supabase 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const pendingResponse = await fetch(
    `${url}/rest/v1/sports_predictions?select=id,league,game_date,away_team,home_team,predicted_winner,result&result=eq.pending&order=game_date.asc&limit=1000`,
    { headers: headers(key), cache: "no-store" },
  );

  if (!pendingResponse.ok) {
    return NextResponse.json(
      { success: false, message: "결과대기 예측을 불러오지 못했습니다.", detail: await pendingResponse.text() },
      { status: 500 },
    );
  }

  const rows = (await pendingResponse.json()) as PredictionRow[];
  const origin = new URL(request.url).origin;
  const authorization = request.headers.get("authorization");
  const groups = new Map<string, PredictionRow[]>();

  for (const row of rows) {
    const groupKey = `${row.league}|${row.game_date}`;
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), row]);
  }

  let updated = 0;
  let stillPending = 0;
  let missingGame = 0;
  let notFinal = 0;
  const errors: string[] = [];
  const updates: Array<{ id: number; league: League; game: string; result: string; score: string }> = [];

  for (const [groupKey, groupRows] of groups) {
    const [league, date] = groupKey.split("|") as [League, string];
    try {
      const games = await loadSchedule(origin, league, date, authorization);

      for (const row of groupRows) {
        const game = games.find((item) => {
          const teams = gameTeams(item);
          return normalize(teams.away) === normalize(row.away_team) && normalize(teams.home) === normalize(row.home_team);
        });

        if (!game) {
          missingGame++;
          stillPending++;
          continue;
        }

        const scores = gameScores(game);
        if (!isFinal(game) || scores.away == null || scores.home == null) {
          notFinal++;
          stillPending++;
          continue;
        }

        const result = resultOf(row, scores.away, scores.home);
        const patch = await fetch(`${url}/rest/v1/sports_predictions?id=eq.${row.id}`, {
          method: "PATCH",
          headers: headers(key, { Prefer: "return=minimal" }),
          body: JSON.stringify({
            actual_score_away: scores.away,
            actual_score_home: scores.home,
            result,
            updated_at: new Date().toISOString(),
          }),
          cache: "no-store",
        });

        if (!patch.ok) {
          errors.push(`${league} ${date} ${row.away_team}-${row.home_team}: DB ${patch.status}`);
          continue;
        }

        updated++;
        updates.push({
          id: row.id,
          league,
          game: `${row.away_team} vs ${row.home_team}`,
          result,
          score: `${scores.away}:${scores.home}`,
        });
      }
    } catch (error) {
      errors.push(`${league} ${date}: ${error instanceof Error ? error.message : "조회 실패"}`);
      stillPending += groupRows.length;
    }
  }

  return NextResponse.json({
    success: errors.length === 0,
    checked: rows.length,
    updated,
    pending: stillPending,
    missingGame,
    notFinal,
    updates,
    errors,
  });
}

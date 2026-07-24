import { NextResponse } from "next/server";
import { deleteExpiredSportsCache } from "../../../lib/sports-db-cache";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function kstDate(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function authHeader() {
  return { Authorization: `Bearer ${process.env.CRON_SECRET || ""}` };
}

async function warm(origin: string, path: string, ttl: number) {
  const url = `${origin}/api/data-cache?path=${encodeURIComponent(path)}&ttl=${ttl}&refresh=1`;
  const response = await fetch(url, { headers: authHeader(), cache: "no-store" });
  return { path, ok: response.ok, status: response.status };
}

async function cachedJson(origin: string, path: string, ttl: number) {
  const url = `${origin}/api/data-cache?path=${encodeURIComponent(path)}&ttl=${ttl}&refresh=1`;
  return fetch(url, { headers: authHeader(), cache: "no-store" })
    .then((response) => response.json())
    .catch(() => null);
}

function gameArray(payload: any) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.games)) return payload.games;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function query(path: string, values: Record<string, unknown>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    const text = String(value ?? "").trim();
    if (text) params.set(key, text);
  }
  return `${path}?${params.toString()}`;
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, message: "인증 실패" }, { status: 401 });
  }

  const origin = new URL(request.url).origin;
  const dates = [kstDate(-2), kstDate(-1), kstDate(0), kstDate(1)];
  const results: Array<{ path: string; ok: boolean; status: number }> = [];

  for (const date of dates) {
    const schedules = {
      KBO: await cachedJson(origin, `/api/kbo?date=${date}`, 300),
      NPB: await cachedJson(origin, `/api/npb?date=${date}`, 300),
      MLB: await cachedJson(origin, `/api/mlb?date=${date}`, 300),
    };

    results.push(
      { path: `/api/kbo?date=${date}`, ok: Boolean(schedules.KBO), status: schedules.KBO ? 200 : 500 },
      { path: `/api/npb?date=${date}`, ok: Boolean(schedules.NPB), status: schedules.NPB ? 200 : 500 },
      { path: `/api/mlb?date=${date}`, ok: Boolean(schedules.MLB), status: schedules.MLB ? 200 : 500 },
    );

    results.push(await warm(origin, "/api/kbo/standings", 1800));
    results.push(await warm(origin, "/api/kbo/team-batting", 1800));
    results.push(await warm(origin, `/api/npb/standings?season=${date.slice(0, 4)}`, 1800));
    results.push(await warm(origin, `/api/mlb/standings?season=${date.slice(0, 4)}`, 1800));

    for (const game of gameArray(schedules.KBO)) {
      const away = game.away || "";
      const home = game.home || "";
      if (!away || !home) continue;
      results.push(await warm(origin, query("/api/betman", { date, away, home }), 1800));
    }

    for (const game of gameArray(schedules.NPB)) {
      const away = game.away || "";
      const home = game.home || "";
      const stadium = game.stadium || "";
      const awayStarter = game.awayStarter || "";
      const homeStarter = game.homeStarter || "";
      if (!away || !home) continue;

      results.push(await warm(origin, query("/api/npb/analysis", { away, home, date, awayStarter, homeStarter, stadium }), 900));
      if (stadium) results.push(await warm(origin, query("/api/npb/weather", { stadium, date }), 3600));
      results.push(await warm(origin, query("/api/npb/market", { away, home, date }), 1800));
    }

    for (const game of gameArray(schedules.MLB)) {
      const away = game.awayApi || game.away || "";
      const home = game.homeApi || game.home || "";
      if (!away || !home) continue;
      results.push(await warm(origin, query("/api/mlb/market", {
        league: "MLB",
        date,
        away,
        home,
        commenceTime: game.commenceTime || game.startTime || "",
      }), 1800));
    }
  }

  // 전날 종료 경기의 실제 점수와 적중 여부를 자동 반영합니다.
  const resultResponse = await fetch(`${origin}/api/predictions/results`, {
    method: "POST",
    headers: authHeader(),
    cache: "no-store",
  });
  const resultUpdate = await resultResponse.json().catch(() => null);

  await deleteExpiredSportsCache();

  return NextResponse.json({
    success: true,
    refreshedAt: new Date().toISOString(),
    total: results.length,
    successCount: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok),
    resultUpdate,
  });
}

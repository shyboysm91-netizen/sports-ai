import { NextResponse } from "next/server";
import { deleteExpiredSportsCache } from "../../../lib/sports-db-cache";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

async function warm(origin: string, path: string, ttl: number) {
  const url =
    `${origin}/api/data-cache?path=${encodeURIComponent(path)}` +
    `&ttl=${ttl}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.CRON_SECRET || ""}`,
    },
    cache: "no-store",
  });

  return { path, ok: response.ok, status: response.status };
}

function gameArray(payload: any) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.games)) return payload.games;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    auth !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const origin = new URL(request.url).origin;
  const dates = [kstDate(0), kstDate(1)];
  const results: Array<{ path: string; ok: boolean; status: number }> = [];

  for (const date of dates) {
    const schedulePaths = [
      `/api/kbo?date=${date}`,
      `/api/mlb?date=${date}`,
      `/api/npb?date=${date}`,
    ];

    for (const schedulePath of schedulePaths) {
      results.push(await warm(origin, schedulePath, 300));
    }

    // KBO 공통 시즌 데이터
    results.push(await warm(origin, "/api/kbo/standings", 1800));
    results.push(await warm(origin, "/api/kbo/team-batting", 1800));

    // 일정 데이터에서 경기별 NPB 분석/날씨/배당을 자동 선반영
    const npbSchedule = await fetch(
      `${origin}/api/data-cache?path=${encodeURIComponent(
        `/api/npb?date=${date}`,
      )}&ttl=300`,
      { cache: "no-store" },
    ).then((r) => r.json()).catch(() => null);

    for (const game of gameArray(npbSchedule)) {
      const away = game.away || "";
      const home = game.home || "";
      const stadium = game.stadium || "";
      const awayStarter = game.awayStarter || "";
      const homeStarter = game.homeStarter || "";
      if (!away || !home) continue;

      results.push(
        await warm(
          origin,
          `/api/npb/analysis?away=${encodeURIComponent(
            away,
          )}&home=${encodeURIComponent(home)}&date=${date}` +
            `&awayStarter=${encodeURIComponent(
              awayStarter,
            )}&homeStarter=${encodeURIComponent(homeStarter)}` +
            `&stadium=${encodeURIComponent(stadium)}`,
          600,
        ),
      );

      results.push(
        await warm(
          origin,
          `/api/npb/weather?stadium=${encodeURIComponent(
            stadium,
          )}&date=${date}`,
          3600,
        ),
      );

      results.push(
        await warm(
          origin,
          `/api/npb/market?away=${encodeURIComponent(
            away,
          )}&home=${encodeURIComponent(home)}&date=${date}`,
          600,
        ),
      );
    }
  }

  await deleteExpiredSportsCache();

  return NextResponse.json({
    success: true,
    refreshedAt: new Date().toISOString(),
    total: results.length,
    successCount: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok),
  });
}

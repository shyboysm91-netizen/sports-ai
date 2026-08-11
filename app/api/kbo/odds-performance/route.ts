import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
type CacheRow = { cache_key?: string; payload?: { market?: { moneyline?: { away?: number; home?: number } | null } | null } };
type ResultRow = { game_date?: string; away_team?: string; home_team?: string; actual_score_away?: number | null; actual_score_home?: number | null };

function config() {
  return { url: (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, ""), key: process.env.SUPABASE_SERVICE_ROLE_KEY || "" };
}
function headers(key: string) { return { apikey: key, Authorization: `Bearer ${key}` }; }
function cleanTeam(value: string) { return value.normalize("NFKC").replace(/\s+/g, " ").trim(); }
function parseCacheKey(value: string) {
  try {
    const params = new URLSearchParams(value.includes("?") ? value.slice(value.indexOf("?")) : "");
    return { date: params.get("date") ?? "", away: cleanTeam(params.get("away") ?? ""), home: cleanTeam(params.get("home") ?? "") };
  } catch { return { date: "", away: "", home: "" }; }
}

export async function GET(request: Request) {
  const search = new URL(request.url).searchParams;
  const away = cleanTeam(search.get("away") ?? ""), home = cleanTeam(search.get("home") ?? "");
  const awayOdds = Number(search.get("awayOdds")), homeOdds = Number(search.get("homeOdds"));
  if (!away || !home || !Number.isFinite(awayOdds) || !Number.isFinite(homeOdds)) return NextResponse.json({ success: false, message: "팀과 배당 정보가 필요합니다." }, { status: 400 });
  const { url, key } = config();
  if (!url || !key) return NextResponse.json({ success: false, message: "서버 기록 저장소가 설정되지 않았습니다." });

  const [cacheResponse, resultResponse] = await Promise.all([
    fetch(`${url}/rest/v1/sports_cache?select=cache_key,payload&cache_key=like.%2Fapi%2Fbetman%25&limit=2000`, { headers: headers(key), cache: "no-store" }),
    fetch(`${url}/rest/v1/sports_predictions?select=game_date,away_team,home_team,actual_score_away,actual_score_home&league=eq.KBO&actual_score_away=not.is.null&actual_score_home=not.is.null&limit=2000`, { headers: headers(key), cache: "no-store" }),
  ]);
  if (!cacheResponse.ok || !resultResponse.ok) return NextResponse.json({ success: false, message: "과거 배당 또는 경기 결과를 불러오지 못했습니다." });
  const caches = (await cacheResponse.json()) as CacheRow[], results = (await resultResponse.json()) as ResultRow[];
  const resultMap = new Map(results.map((row) => [`${row.game_date}|${cleanTeam(row.away_team ?? "")}|${cleanTeam(row.home_team ?? "")}`, row]));

  function stats(team: string, targetOdds: number) {
    let games = 0, wins = 0;
    for (const row of caches) {
      const game = parseCacheKey(row.cache_key ?? ""), moneyline = row.payload?.market?.moneyline;
      if (!moneyline || (game.away !== team && game.home !== team)) continue;
      const recordedOdds = game.away === team ? moneyline.away : moneyline.home;
      if (!Number.isFinite(recordedOdds) || Math.abs(Number(recordedOdds) - targetOdds) > 0.05) continue;
      const result = resultMap.get(`${game.date}|${game.away}|${game.home}`);
      if (result?.actual_score_away == null || result.actual_score_home == null || result.actual_score_away === result.actual_score_home) continue;
      games += 1;
      const awayWon = result.actual_score_away > result.actual_score_home;
      if ((game.away === team && awayWon) || (game.home === team && !awayWon)) wins += 1;
    }
    return { team, odds: targetOdds, games, wins, losses: games - wins, rate: games ? wins / games * 100 : 0, range: `${(targetOdds - .05).toFixed(2)}~${(targetOdds + .05).toFixed(2)}` };
  }
  return NextResponse.json({ success: true, away: stats(away, awayOdds), home: stats(home, homeOdds) });
}

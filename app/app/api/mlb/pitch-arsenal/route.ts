import { NextResponse } from "next/server";

export const revalidate = 21600;

const PITCH_NAMES: Record<string, string> = {
  FF: "포심", SI: "싱커", FC: "커터", SL: "슬라이더", ST: "스위퍼",
  CU: "커브", KC: "너클커브", CH: "체인지업", FS: "스플리터",
  SV: "슬러브", KN: "너클볼", EP: "이퓨스", SC: "스크루볼",
};

type Row = Record<string, string>;

function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((v) => v.length)) rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  const [headers, ...body] = rows;
  if (!headers) return [];
  return body.map((values) => Object.fromEntries(headers.map((h, i) => [h.trim(), values[i] ?? ""])));
}

function num(value: string | undefined) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isSwing(description: string) {
  return ["swinging_strike", "swinging_strike_blocked", "foul", "foul_tip", "hit_into_play", "hit_into_play_no_out", "hit_into_play_score"].includes(description);
}

function isWhiff(description: string) {
  return description === "swinging_strike" || description === "swinging_strike_blocked";
}

function batterSideSplit(items: Row[], side: "L" | "R") {
  const rows = items.filter((r) => r.stand === side);
  const plateAppearances = rows.filter((r) => Boolean(r.events));
  const atBats = plateAppearances.filter((r) => !["walk", "intent_walk", "hit_by_pitch", "sac_fly", "sac_bunt", "catcher_interf"].includes(r.events));
  const hits = atBats.filter((r) => ["single", "double", "triple", "home_run"].includes(r.events)).length;
  const totalBases = atBats.reduce((sum, r) => sum + ({ single: 1, double: 2, triple: 3, home_run: 4 }[r.events] ?? 0), 0);
  const walks = plateAppearances.filter((r) => r.events === "walk" || r.events === "intent_walk").length;
  const hitByPitch = plateAppearances.filter((r) => r.events === "hit_by_pitch").length;
  const sacrificeFlies = plateAppearances.filter((r) => r.events === "sac_fly").length;
  const strikeouts = plateAppearances.filter((r) => r.events === "strikeout" || r.events === "strikeout_double_play").length;
  const homeRuns = plateAppearances.filter((r) => r.events === "home_run").length;
  const avg = atBats.length ? hits / atBats.length : null;
  const obpDen = atBats.length + walks + hitByPitch + sacrificeFlies;
  const obp = obpDen ? (hits + walks + hitByPitch) / obpDen : null;
  const slg = atBats.length ? totalBases / atBats.length : null;
  return {
    side,
    plateAppearances: plateAppearances.length,
    atBats: atBats.length,
    battingAvg: avg,
    ops: obp != null && slg != null ? obp + slg : null,
    strikeoutRate: plateAppearances.length ? strikeouts / plateAppearances.length * 100 : null,
    walkRate: plateAppearances.length ? walks / plateAppearances.length * 100 : null,
    homeRuns,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const playerId = Number(searchParams.get("playerId") ?? 0);
  const season = Number(searchParams.get("season") ?? new Date().getUTCFullYear());
  if (!playerId || !season) return NextResponse.json({ success: false, message: "선발투수 코드가 없습니다.", playerId, season, samplePitches: 0, recentSamplePitches: 0, pitches: [] }, { status: 400 });

  const start = `${season}-02-20`;
  const end = `${season}-11-15`;
  const params = new URLSearchParams({ all: "true", type: "pitcher", player_type: "pitcher", game_date_gt: start, game_date_lt: end });
  params.append("hfSeaYear", `${season}|`);
  params.append("hfGT", "R|");
  params.append("player_lookup[]", String(playerId));
  const url = `https://baseballsavant.mlb.com/statcast_search/csv?${params.toString()}`;

  try {
    const response = await fetch(url, { next: { revalidate: 21600 }, headers: { "User-Agent": "Mozilla/5.0 Sports-AI/1.0", Accept: "text/csv,*/*" } });
    if (!response.ok) throw new Error(`Baseball Savant ${response.status}`);
    const text = await response.text();
    const rows = parseCsv(text).filter((row) => row.pitch_type);
    if (!rows.length) return NextResponse.json({ success: false, message: "이번 시즌 Statcast 구종 기록이 아직 없습니다.", playerId, season, samplePitches: 0, recentSamplePitches: 0, pitches: [] });

    const gameDates = [...new Set(rows.map((r) => r.game_date).filter(Boolean))].sort().reverse();
    const recentDates = new Set(gameDates.slice(0, 5));
    const total = rows.length;
    const recentTotal = rows.filter((r) => recentDates.has(r.game_date)).length;
    const groups = new Map<string, Row[]>();
    for (const row of rows) groups.set(row.pitch_type, [...(groups.get(row.pitch_type) ?? []), row]);

    const pitches = [...groups.entries()].map(([code, items]) => {
      const recent = items.filter((r) => recentDates.has(r.game_date));
      const velocities = items.map((r) => num(r.release_speed)).filter((v): v is number => v !== null);
      const ballsInPlay = items.filter((r) => r.events && !["walk", "hit_by_pitch", "strikeout", "strikeout_double_play"].includes(r.events));
      const hits = ballsInPlay.filter((r) => ["single", "double", "triple", "home_run"].includes(r.events)).length;
      const swings = items.filter((r) => isSwing(r.description));
      const whiffs = swings.filter((r) => isWhiff(r.description)).length;
      const strikeouts = items.filter((r) => r.events === "strikeout" || r.events === "strikeout_double_play").length;
      const homeRuns = items.filter((r) => r.events === "home_run").length;
      return {
        code,
        name: PITCH_NAMES[code] ?? code,
        usage: items.length / total * 100,
        recentUsage: recentTotal ? recent.length / recentTotal * 100 : 0,
        avgVelocity: velocities.length ? velocities.reduce((a, b) => a + b, 0) / velocities.length : null,
        battingAvg: ballsInPlay.length ? hits / ballsInPlay.length : null,
        whiffRate: swings.length ? whiffs / swings.length * 100 : null,
        strikeouts,
        homeRuns,
        pitches: items.length,
      };
    }).sort((a, b) => b.usage - a.usage);

    const batterSplits = { vsLeft: batterSideSplit(rows, "L"), vsRight: batterSideSplit(rows, "R") };

    return NextResponse.json({ success: true, playerId, season, samplePitches: total, recentSamplePitches: recentTotal, pitches, batterSplits }, { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" } });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? `구종 데이터를 불러오지 못했습니다: ${error.message}` : "구종 데이터를 불러오지 못했습니다.", playerId, season, samplePitches: 0, recentSamplePitches: 0, pitches: [] }, { status: 200 });
  }
}

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type PredictionLeague = "KBO" | "NPB" | "MLB";
type Input = {
  league?: PredictionLeague;
  date?: string;
  time?: string;
  away?: string;
  home?: string;
  pick?: string;
  awayRate?: number;
  homeRate?: number;
  confidence?: number;
};

function getConfig() {
  const url = (
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  ).replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return { url, key };
}

function kstToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function clampRate(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, number));
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function gameKey(league: string, date: string, away: string, home: string) {
  return `${league}|${date}|${away}|${home}`
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function headers(key: string, extra?: Record<string, string>) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export async function GET(request: Request) {
  const { url, key } = getConfig();
  if (!url || !key) {
    return NextResponse.json(
      {
        success: false,
        configured: false,
        message: "Supabase 환경변수가 설정되지 않았습니다.",
      },
      { status: 500 }
    );
  }

  const requestUrl = new URL(request.url);
  if (requestUrl.searchParams.get("list") === "1") {
    const listResponse = await fetch(
      `${url}/rest/v1/sports_predictions?select=*&order=game_date.desc,created_at.desc&limit=2000`,
      { headers: headers(key), cache: "no-store" },
    );
    if (!listResponse.ok) {
      return NextResponse.json(
        { success: false, message: "DB 예측 기록을 불러오지 못했습니다.", detail: await listResponse.text() },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: true, rows: await listResponse.json() });
  }

  const response = await fetch(
    `${url}/rest/v1/sports_predictions?select=id&limit=1`,
    { headers: headers(key), cache: "no-store" }
  );

  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json(
      {
        success: false,
        configured: true,
        connected: false,
        message: `Supabase 연결 실패 (${response.status})`,
        detail,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    configured: true,
    connected: true,
  });
}

export async function POST(request: Request) {
  const { url, key } = getConfig();
  if (!url || !key) {
    return NextResponse.json(
      { success: false, message: "Supabase 환경변수가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  let input: Input;
  try {
    input = (await request.json()) as Input;
  } catch {
    return NextResponse.json(
      { success: false, message: "요청 데이터 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const league = cleanText(input.league).toUpperCase() as PredictionLeague;
  const date = cleanText(input.date);
  const time = cleanText(input.time);
  const away = cleanText(input.away);
  const home = cleanText(input.home);
  const pick = cleanText(input.pick);

  if (!["KBO", "NPB", "MLB"].includes(league)) {
    return NextResponse.json(
      { success: false, message: "리그 정보가 올바르지 않습니다." },
      { status: 400 }
    );
  }
  if (!validDate(date) || !away || !home || !pick) {
    return NextResponse.json(
      { success: false, message: "경기와 예측 정보가 부족합니다." },
      { status: 400 }
    );
  }

  // 과거 경기를 다시 열어 소급 예측이 저장되는 것을 차단합니다.
  if (date < kstToday()) {
    return NextResponse.json({
      success: true,
      saved: false,
      reason: "past_game",
    });
  }

  const row = {
    league,
    game_key: gameKey(league, date, away, home),
    game_date: date,
    home_team: home,
    away_team: away,
    predicted_winner: pick,
    confidence: clampRate(input.confidence),
    home_win_probability: clampRate(input.homeRate),
    away_win_probability: clampRate(input.awayRate),
    result: "pending",
  };

  // unique(league, game_key) 충돌은 무시하여 최초 추천을 고정합니다.
  const response = await fetch(
    `${url}/rest/v1/sports_predictions?on_conflict=league,game_key`,
    {
      method: "POST",
      headers: headers(key, {
        Prefer: "resolution=ignore-duplicates,return=representation",
      }),
      body: JSON.stringify([row]),
      cache: "no-store",
    }
  );

  const detail = await response.text();
  if (!response.ok) {
    return NextResponse.json(
      {
        success: false,
        message: `예측 DB 저장 실패 (${response.status})`,
        detail,
      },
      { status: 500 }
    );
  }

  let inserted: unknown[] = [];
  try {
    inserted = detail ? JSON.parse(detail) : [];
  } catch {
    inserted = [];
  }

  return NextResponse.json({
    success: true,
    saved: inserted.length > 0,
    duplicate: inserted.length === 0,
    gameKey: row.game_key,
    gameTime: time || null,
  });
}

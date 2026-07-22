import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function config() {
  return {
    url: (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, ""),
    key: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  };
}

function headers(key: string, prefer?: string) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

export async function GET() {
  const { url, key } = config();
  if (!url || !key) {
    return NextResponse.json({ success: false, message: "Supabase 환경변수가 없습니다." }, { status: 500 });
  }

  const token = `connection-test-${Date.now()}`;
  const row = {
    league: "KBO",
    game_key: token,
    game_date: "2099-12-31",
    home_team: "DB 테스트 홈",
    away_team: "DB 테스트 원정",
    predicted_winner: "DB 테스트 홈",
    confidence: 50,
    home_win_probability: 50,
    away_win_probability: 50,
    result: "pending",
  };

  const insert = await fetch(`${url}/rest/v1/sports_predictions`, {
    method: "POST",
    headers: headers(key, "return=representation"),
    body: JSON.stringify([row]),
    cache: "no-store",
  });
  const insertText = await insert.text();

  if (!insert.ok) {
    return NextResponse.json({ success: false, step: "insert", status: insert.status, detail: insertText }, { status: 500 });
  }

  const remove = await fetch(`${url}/rest/v1/sports_predictions?game_key=eq.${encodeURIComponent(token)}`, {
    method: "DELETE",
    headers: headers(key),
    cache: "no-store",
  });

  return NextResponse.json({
    success: remove.ok,
    writeConnected: true,
    cleanup: remove.ok,
    message: remove.ok ? "Supabase 쓰기·삭제 테스트 성공" : "저장은 성공했지만 테스트 행 삭제에 실패했습니다.",
  });
}

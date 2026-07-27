import { NextResponse } from "next/server";
import { loadReelAnalysis, type ContentGame, type ContentLeague } from "@/app/lib/content-analysis";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const league = String(body?.league || "").toUpperCase() as ContentLeague;
    const date = String(body?.date || "").trim();
    const game = (body?.game || {}) as ContentGame;

    if (!(["KBO", "MLB", "NPB"] as string[]).includes(league)) {
      return NextResponse.json({ success: false, message: "지원하지 않는 리그입니다." }, { status: 400 });
    }
    if (!date || !game?.away || !game?.home) {
      return NextResponse.json({ success: false, message: "경기 정보가 부족합니다." }, { status: 400 });
    }

    const origin = new URL(request.url).origin;
    const analysis = await loadReelAnalysis(origin, league, game, date);
    return NextResponse.json({ success: true, analysis }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("릴스 분석 데이터 오류:", error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "릴스 분석 데이터를 불러오지 못했습니다.",
    }, { status: 500 });
  }
}

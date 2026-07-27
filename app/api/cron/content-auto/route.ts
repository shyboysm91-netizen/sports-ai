import { NextRequest, NextResponse } from "next/server";
import { runAutomaticContent } from "@/app/lib/auto-content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: NextRequest) {
  const secret = process.env.AUTO_CONTENT_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization") || "";
  return auth === `Bearer ${secret}` || request.nextUrl.searchParams.get("secret") === secret;
}

async function run(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ success: false, message: "자동 실행 인증 실패" }, { status: 401 });
  try {
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin).replace(/\/$/, "");
    const results = await runAutomaticContent(siteUrl);
    return NextResponse.json({ success: true, created: results.length, results, message: results.length ? `${results.length}개 자동 릴스를 텔레그램으로 보냈습니다.` : "새로 만들 경기가 없습니다." });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "자동 콘텐츠 생성 실패" }, { status: 500 });
  }
}
export const GET = run;
export const POST = run;

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const requested = Array.isArray(body?.platforms) ? body.platforms : [];
  const status = {
    youtube: Boolean(process.env.YOUTUBE_ACCESS_TOKEN),
    instagram: Boolean(process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_USER_ID),
    tiktok: Boolean(process.env.TIKTOK_ACCESS_TOKEN && process.env.TIKTOK_OPEN_ID),
  };
  const unavailable = requested.filter((key: string) => !status[key as keyof typeof status]);
  if (unavailable.length) {
    return NextResponse.json({
      success: false,
      message: `${unavailable.join(", ")} 계정 연결이 필요합니다. 현재 버전은 콘텐츠 파일 생성과 텔레그램 승인까지 완료되어 있습니다.`,
      status,
    }, { status: 400 });
  }
  return NextResponse.json({
    success: false,
    message: "각 플랫폼은 OAuth 승인과 공개 미디어 URL이 필요합니다. 계정 토큰을 연결한 뒤 업로드 모듈을 활성화하세요.",
    status,
  }, { status: 501 });
}

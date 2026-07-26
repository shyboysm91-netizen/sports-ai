import { NextRequest, NextResponse } from "next/server";
import { getValidToken } from "@/app/lib/youtube-oauth";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const youtubeToken = await getValidToken(request).catch(()=>null);
  return NextResponse.json({
    success: true,
    telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    youtube: Boolean(youtubeToken),
    ttsConfigured: Boolean(process.env.GOOGLE_TTS_API_KEY),
    youtubeConfigured: Boolean(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET && (process.env.YOUTUBE_TOKEN_SECRET || process.env.CONTENT_APPROVAL_SECRET)),
    instagram: Boolean(process.env.INSTAGRAM_ACCESS_TOKEN && (process.env.INSTAGRAM_ACCOUNT_ID || process.env.INSTAGRAM_USER_ID)),
    tiktok: Boolean(process.env.TIKTOK_ACCESS_TOKEN && process.env.TIKTOK_OPEN_ID),
    note: "플랫폼 API 키와 계정 승인이 완료된 항목만 실제 발행할 수 있습니다.",
  });
}

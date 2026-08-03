import { NextRequest, NextResponse } from "next/server";
import { createTikTokState } from "@/app/lib/tiktok-oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  if (!clientKey) return NextResponse.json({ success: false, message: "TIKTOK_CLIENT_KEY가 필요합니다." }, { status: 500 });
  if (!process.env.TIKTOK_CLIENT_SECRET) return NextResponse.json({ success: false, message: "TIKTOK_CLIENT_SECRET이 필요합니다." }, { status: 500 });
  if (!process.env.TIKTOK_TOKEN_SECRET && !process.env.CONTENT_APPROVAL_SECRET) {
    return NextResponse.json({ success: false, message: "TIKTOK_TOKEN_SECRET이 필요합니다." }, { status: 500 });
  }

  const origin = (process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin).replace(/\/$/, "");
  const redirectUri = process.env.TIKTOK_REDIRECT_URI || `${origin}/api/content/tiktok/callback`;
  // 현재 승인된 video.upload로 연결됩니다. Direct Post 승인 후 TIKTOK_SCOPES에 video.publish를 추가하세요.
  const scope = process.env.TIKTOK_SCOPES || "user.info.basic,video.upload";
  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
  url.searchParams.set("client_key", clientKey);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scope);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", createTikTokState());
  url.searchParams.set("disable_auto_auth", "1");
  return NextResponse.redirect(url);
}

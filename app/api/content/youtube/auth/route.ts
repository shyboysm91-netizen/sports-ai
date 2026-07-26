import { NextRequest, NextResponse } from "next/server";
import { oauthState } from "@/app/lib/youtube-oauth";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  if (!clientId) return NextResponse.json({ success:false, message:"YOUTUBE_CLIENT_ID가 필요합니다." }, { status:500 });
  const origin = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const redirectUri = `${origin}/api/content/youtube/callback`;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId); url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code"); url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent"); url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("scope", "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly");
  url.searchParams.set("state", oauthState());
  return NextResponse.redirect(url);
}

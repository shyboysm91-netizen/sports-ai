import { NextRequest, NextResponse } from "next/server";
import { cookieName, encryptToken, persistYoutubeToken, validState } from "@/app/lib/youtube-oauth";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code"); const state = request.nextUrl.searchParams.get("state");
  const origin = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  if (!code || !validState(state)) return NextResponse.redirect(`${origin}/content?youtube=error`);
  const redirectUri = `${origin}/api/content/youtube/callback`;
  const response = await fetch("https://oauth2.googleapis.com/token", { method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded"}, body:new URLSearchParams({ code, client_id:process.env.YOUTUBE_CLIENT_ID||"", client_secret:process.env.YOUTUBE_CLIENT_SECRET||"", redirect_uri:redirectUri, grant_type:"authorization_code" }), cache:"no-store" });
  const json = await response.json();
  if (!response.ok || !json.access_token) return NextResponse.redirect(`${origin}/content?youtube=error`);
  const tokenData = { access_token:json.access_token, refresh_token:json.refresh_token, expires_at:Date.now()+Number(json.expires_in||3600)*1000, scope:json.scope };
  await persistYoutubeToken(tokenData);
  const res = NextResponse.redirect(`${origin}/content?youtube=connected`);
  res.cookies.set(cookieName(), encryptToken(tokenData), { httpOnly:true, secure:origin.startsWith("https://"), sameSite:"lax", path:"/", maxAge:60*60*24*180 });
  return res;
}

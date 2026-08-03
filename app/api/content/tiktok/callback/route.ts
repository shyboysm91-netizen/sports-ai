import { NextRequest, NextResponse } from "next/server";
import { encryptTikTokToken, persistTikTokToken, tiktokCookieName, validTikTokState } from "@/app/lib/tiktok-oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin).replace(/\/$/, "");
  const error = request.nextUrl.searchParams.get("error");
  const errorDescription = request.nextUrl.searchParams.get("error_description");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (error || !code || !validTikTokState(state)) {
    const reason = encodeURIComponent(errorDescription || error || "invalid_state");
    return NextResponse.redirect(`${origin}/content?tiktok=error&reason=${reason}`);
  }

  const redirectUri = process.env.TIKTOK_REDIRECT_URI || `${origin}/api/content/tiktok/callback`;
  const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY || "",
      client_secret: process.env.TIKTOK_CLIENT_SECRET || "",
      code: decodeURIComponent(code),
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.access_token || !json.open_id) {
    const reason = encodeURIComponent(json.error_description || json.error || "token_exchange_failed");
    return NextResponse.redirect(`${origin}/content?tiktok=error&reason=${reason}`);
  }

  const tokenData = {
    access_token: String(json.access_token),
    refresh_token: json.refresh_token ? String(json.refresh_token) : undefined,
    open_id: String(json.open_id),
    expires_at: Date.now() + Number(json.expires_in || 86400) * 1000,
    refresh_expires_at: Date.now() + Number(json.refresh_expires_in || 31536000) * 1000,
    scope: String(json.scope || ""),
  };
  await persistTikTokToken(tokenData);
  const result = NextResponse.redirect(`${origin}/content?tiktok=connected`);
  result.cookies.set(tiktokCookieName(), encryptTikTokToken(tokenData), {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  return result;
}

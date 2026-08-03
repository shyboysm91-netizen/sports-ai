import { NextRequest, NextResponse } from "next/server";
import { clearTikTokToken, getValidTikTokToken, tiktokCookieName } from "@/app/lib/tiktok-oauth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const token = await getValidTikTokToken(request).catch(() => null);
  if (token?.access_token && process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET) {
    await fetch("https://open.tiktokapis.com/v2/oauth/revoke/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY,
        client_secret: process.env.TIKTOK_CLIENT_SECRET,
        token: token.access_token,
      }),
      cache: "no-store",
    }).catch(() => undefined);
  }
  await clearTikTokToken();
  const response = NextResponse.json({ success: true });
  response.cookies.set(tiktokCookieName(), "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}

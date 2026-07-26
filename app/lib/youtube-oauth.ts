import crypto from "crypto";
import { NextRequest } from "next/server";
import { readYoutubeToken, saveYoutubeToken } from "@/app/lib/content-automation-store";

const COOKIE = "sports_ai_youtube";

type TokenData = { access_token: string; refresh_token?: string; expires_at: number; scope?: string };

function secret() {
  const value = process.env.YOUTUBE_TOKEN_SECRET || process.env.CONTENT_APPROVAL_SECRET;
  if (!value) throw new Error("YOUTUBE_TOKEN_SECRET 환경변수가 필요합니다.");
  return crypto.createHash("sha256").update(value).digest();
}

export function cookieName() { return COOKIE; }

export function encryptToken(data: TokenData) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", secret(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptToken(value?: string): TokenData | null {
  try {
    if (!value) return null;
    const raw = Buffer.from(value, "base64url");
    const iv = raw.subarray(0, 12); const tag = raw.subarray(12, 28); const encrypted = raw.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", secret(), iv);
    decipher.setAuthTag(tag);
    const decoded = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    return JSON.parse(decoded) as TokenData;
  } catch { return null; }
}

export async function getValidToken(request?: NextRequest): Promise<TokenData | null> {
  const cookieValue = request?.cookies.get(COOKIE)?.value;
  const serverValue = cookieValue ? null : await readYoutubeToken().catch(() => null);
  const stored = decryptToken(cookieValue || serverValue || undefined);
  if (!stored) return null;
  if (cookieValue) await saveYoutubeToken(encryptToken(stored)).catch(() => false);
  if (stored.expires_at > Date.now() + 60_000) return stored;
  if (!stored.refresh_token || !process.env.YOUTUBE_CLIENT_ID || !process.env.YOUTUBE_CLIENT_SECRET) return null;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.YOUTUBE_CLIENT_ID, client_secret: process.env.YOUTUBE_CLIENT_SECRET, refresh_token: stored.refresh_token, grant_type: "refresh_token" }),
    cache: "no-store",
  });
  const json = await response.json();
  if (!response.ok || !json.access_token) return null;
  const refreshed = { ...stored, access_token: json.access_token, expires_at: Date.now() + Number(json.expires_in || 3600) * 1000 };
  await saveYoutubeToken(encryptToken(refreshed)).catch(() => false);
  return refreshed;
}

export function oauthState() {
  const timestamp = String(Date.now());
  const key = process.env.YOUTUBE_TOKEN_SECRET || process.env.CONTENT_APPROVAL_SECRET || "";
  const sig = crypto.createHmac("sha256", key).update(timestamp).digest("hex");
  return `${timestamp}.${sig}`;
}

export function validState(state: string | null) {
  if (!state) return false;
  const [timestamp, sig] = state.split(".");
  if (!timestamp || !sig || Date.now() - Number(timestamp) > 10 * 60 * 1000) return false;
  const key = process.env.YOUTUBE_TOKEN_SECRET || process.env.CONTENT_APPROVAL_SECRET || "";
  const expected = crypto.createHmac("sha256", key).update(timestamp).digest("hex");
  try { return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)); } catch { return false; }
}

export async function persistYoutubeToken(data: TokenData) {
  return saveYoutubeToken(encryptToken(data));
}

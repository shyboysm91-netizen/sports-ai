import crypto from "crypto";
import { NextRequest } from "next/server";
import { readTikTokToken, saveTikTokToken } from "@/app/lib/content-automation-store";

const COOKIE = "sports_ai_tiktok";

export type TikTokTokenData = {
  access_token: string;
  refresh_token?: string;
  open_id: string;
  expires_at: number;
  refresh_expires_at?: number;
  scope?: string;
};

function encryptionKey() {
  const value = process.env.TIKTOK_TOKEN_SECRET || process.env.CONTENT_APPROVAL_SECRET;
  if (!value) throw new Error("TIKTOK_TOKEN_SECRET 환경변수가 필요합니다.");
  return crypto.createHash("sha256").update(value).digest();
}

function stateKey() {
  return process.env.TIKTOK_TOKEN_SECRET || process.env.CONTENT_APPROVAL_SECRET || "";
}

export function tiktokCookieName() { return COOKIE; }

export function encryptTikTokToken(data: TikTokTokenData) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptTikTokToken(value?: string): TikTokTokenData | null {
  try {
    if (!value) return null;
    const raw = Buffer.from(value, "base64url");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const encrypted = raw.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    const decoded = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    return JSON.parse(decoded) as TikTokTokenData;
  } catch {
    return null;
  }
}

export function createTikTokState() {
  const timestamp = String(Date.now());
  const nonce = crypto.randomBytes(12).toString("hex");
  const value = `${timestamp}.${nonce}`;
  const sig = crypto.createHmac("sha256", stateKey()).update(value).digest("hex");
  return `${value}.${sig}`;
}

export function validTikTokState(state: string | null) {
  if (!state) return false;
  const [timestamp, nonce, sig] = state.split(".");
  if (!timestamp || !nonce || !sig || Date.now() - Number(timestamp) > 10 * 60 * 1000) return false;
  const value = `${timestamp}.${nonce}`;
  const expected = crypto.createHmac("sha256", stateKey()).update(value).digest("hex");
  try { return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)); } catch { return false; }
}

export async function persistTikTokToken(data: TikTokTokenData) {
  return saveTikTokToken(encryptTikTokToken(data));
}

async function refreshTikTokToken(stored: TikTokTokenData): Promise<TikTokTokenData | null> {
  if (!stored.refresh_token || !process.env.TIKTOK_CLIENT_KEY || !process.env.TIKTOK_CLIENT_SECRET) return null;
  const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY,
      client_secret: process.env.TIKTOK_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: stored.refresh_token,
    }),
    cache: "no-store",
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.access_token) return null;
  const refreshed: TikTokTokenData = {
    access_token: String(json.access_token),
    refresh_token: String(json.refresh_token || stored.refresh_token),
    open_id: String(json.open_id || stored.open_id),
    expires_at: Date.now() + Number(json.expires_in || 86400) * 1000,
    refresh_expires_at: Date.now() + Number(json.refresh_expires_in || 31536000) * 1000,
    scope: String(json.scope || stored.scope || ""),
  };
  await persistTikTokToken(refreshed).catch(() => false);
  return refreshed;
}

export async function getValidTikTokToken(request?: NextRequest): Promise<TikTokTokenData | null> {
  const cookieValue = request?.cookies.get(COOKIE)?.value;
  const serverValue = cookieValue ? null : await readTikTokToken().catch(() => null);
  const stored = decryptTikTokToken(cookieValue || serverValue || undefined);
  if (stored) {
    if (cookieValue) await persistTikTokToken(stored).catch(() => false);
    if (stored.expires_at > Date.now() + 60_000) return stored;
    return refreshTikTokToken(stored);
  }

  // 기존 수동 환경변수 방식도 유지합니다.
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  const openId = process.env.TIKTOK_OPEN_ID;
  if (accessToken && openId) {
    return {
      access_token: accessToken,
      open_id: openId,
      expires_at: Date.now() + 60 * 60 * 1000,
      scope: process.env.TIKTOK_SCOPES || "video.publish,video.upload,user.info.basic",
    };
  }
  return null;
}

export async function clearTikTokToken() {
  await saveTikTokToken("").catch(() => false);
}

import { NextResponse } from "next/server";
import {
  cacheKey,
  readSportsCache,
  sportsDbConfigured,
  writeSportsCache,
} from "../../lib/sports-db-cache";

export const dynamic = "force-dynamic";

const ALLOWED_PREFIXES = [
  "/api/kbo",
  "/api/mlb",
  "/api/npb",
  "/api/betman",
];

function safePath(value: string) {
  if (!value.startsWith("/api/")) return false;
  if (value.startsWith("/api/data-cache")) return false;
  if (value.startsWith("/api/cron")) return false;
  return ALLOWED_PREFIXES.some((prefix) => value.startsWith(prefix));
}

function ttlValue(raw: string | null) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 600;
  return Math.max(60, Math.min(21600, Math.floor(parsed)));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const path = url.searchParams.get("path") || "";
  const ttl = ttlValue(url.searchParams.get("ttl"));

  if (!safePath(path)) {
    return NextResponse.json(
      { success: false, message: "허용되지 않은 데이터 경로입니다." },
      { status: 400 },
    );
  }

  const key = cacheKey(path);
  const saved = await readSportsCache(key);

  if (saved?.fresh) {
    return NextResponse.json(saved.payload, {
      headers: {
        "X-Sports-Cache": "DB-HIT",
        "X-Sports-Cache-Updated": saved.updatedAt,
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  }

  try {
    const internalUrl = new URL(path, url.origin);
    const response = await fetch(internalUrl, {
      next: { revalidate: ttl },
      headers: { Accept: "application/json" },
    });

    const payload = await response.json();

    if (response.ok) {
      await writeSportsCache(key, payload, ttl);
    }

    return NextResponse.json(payload, {
      status: response.status,
      headers: {
        "X-Sports-Cache": saved ? "DB-STALE-REFRESHED" : "DB-MISS",
        "X-Sports-DB": sportsDbConfigured() ? "CONNECTED" : "NOT-CONFIGURED",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    if (saved) {
      return NextResponse.json(saved.payload, {
        headers: {
          "X-Sports-Cache": "DB-STALE-FALLBACK",
          "X-Sports-Cache-Updated": saved.updatedAt,
        },
      });
    }

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "데이터 저장소 조회 오류",
      },
      { status: 500 },
    );
  }
}

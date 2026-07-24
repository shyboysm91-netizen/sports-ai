import { NextResponse } from "next/server";
import {
  cacheKey,
  readSportsCache,
  sportsDbConfigured,
  writeSportsCache,
} from "../../lib/sports-db-cache";

export const dynamic = "force-dynamic";

const ALLOWED_PREFIXES = ["/api/kbo", "/api/mlb", "/api/npb", "/api/betman"];

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

function canForceRefresh(request: Request, url: URL) {
  if (url.searchParams.get("refresh") !== "1") return false;
  const secret = process.env.CRON_SECRET || "";
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const path = url.searchParams.get("path") || "";
  const ttl = ttlValue(url.searchParams.get("ttl"));
  const forceRefresh = canForceRefresh(request, url);

  if (!safePath(path)) {
    return NextResponse.json(
      { success: false, message: "허용되지 않은 데이터 경로입니다." },
      { status: 400 },
    );
  }

  const key = cacheKey(path);
  const saved = await readSportsCache(key);

  // 일반 방문자는 만료 여부와 관계없이 DB에 저장된 값을 봅니다.
  // 외부 API 강제 갱신은 CRON_SECRET으로 인증된 자동 작업만 가능합니다.
  if (saved && !forceRefresh) {
    return NextResponse.json(saved.payload, {
      headers: {
        "X-Sports-Cache": saved.fresh ? "DB-HIT" : "DB-STALE-SERVED",
        "X-Sports-Cache-Updated": saved.updatedAt,
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  }

  try {
    const internalUrl = new URL(path, url.origin);
    const response = await fetch(internalUrl, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error(`API가 JSON 대신 다른 응답을 반환했습니다. (${response.status})`);
    }

    const payload = await response.json();
    if (response.ok) await writeSportsCache(key, payload, ttl);

    return NextResponse.json(payload, {
      status: response.status,
      headers: {
        "X-Sports-Cache": forceRefresh ? "DB-FORCE-REFRESH" : "DB-FIRST-MISS",
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
        message: error instanceof Error ? error.message : "데이터 저장소 조회 오류",
      },
      { status: 500 },
    );
  }
}

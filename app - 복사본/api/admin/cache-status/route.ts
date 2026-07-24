import { NextResponse } from "next/server";

export const revalidate = 60;

export async function GET() {
  return NextResponse.json({
    success: true,
    mode: "vercel-shared-data-cache",
    policy: {
      scheduleSeconds: 300,
      recentFormSeconds: 600,
      teamSeasonSeconds: 1800,
      weatherSeconds: 3600,
      pitcherDetailSeconds: 21600,
      oddsSeconds: 1800,
    },
    message:
      "사용자는 내부 API를 호출하지만, 동일한 외부 데이터 요청은 Vercel 공유 캐시에서 재사용됩니다.",
  }, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}

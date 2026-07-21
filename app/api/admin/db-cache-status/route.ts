import { NextResponse } from "next/server";
import { sportsDbConfigured } from "../../../lib/sports-db-cache";

export async function GET() {
  return NextResponse.json({
    success: true,
    databaseConnected: sportsDbConfigured(),
    mode: sportsDbConfigured()
      ? "Supabase DB 자동 저장"
      : "Vercel 공유 캐시 대체 모드",
    requiredEnvironmentVariables: [
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "CRON_SECRET",
    ],
  });
}

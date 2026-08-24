import { NextResponse } from "next/server";
import {
  bloggerConfigured,
  makeBaseballPosts,
  makeFootballPosts,
  publishBloggerPost,
} from "../../../lib/blogger-auto";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function kstTomorrow() {
  const now = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, message: "인증 실패" }, { status: 401 });
  }
  if (!bloggerConfigured()) {
    return NextResponse.json({ success: false, message: "Blogger API 환경변수가 설정되지 않았습니다." }, { status: 503 });
  }

  const url = new URL(request.url);
  const date = url.searchParams.get("date") || kstTomorrow();
  const origin = url.origin;
  const baseball = await makeBaseballPosts(origin, date);
  const football = await makeFootballPosts(origin, date);
  const candidates = [...baseball, ...football];
  const results = [];
  for (const post of candidates) {
    results.push(await publishBloggerPost(post));
  }

  return NextResponse.json({
    success: true,
    date,
    candidates: candidates.length,
    published: results.filter((item) => !item.skipped).length,
    skipped: results.filter((item) => item.skipped).length,
    results,
  });
}

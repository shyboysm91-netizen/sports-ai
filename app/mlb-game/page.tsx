import type { Metadata } from "next";
import GameClient from "./GameClient";

const BASE_URL = "https://sports-ai-alpha.vercel.app";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function valueOf(value: string | string[] | undefined, fallback: string) {
  return Array.isArray(value) ? value[0] || fallback : value || fallback;
}

function canonicalQuery(params: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();
  for (const [key, raw] of Object.entries(params)) {
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value) query.set(key, value);
  }
  return query.toString();
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const params = await searchParams;
  const away = valueOf(params.away, "원정팀");
  const home = valueOf(params.home, "홈팀");
  const date = valueOf(params.date, "");
  const matchup = `${away} vs ${home}`;
  const dateText = date ? ` ${date}` : "";
  const title = `${matchup}${dateText} MLB AI 분석 및 승부예측`;
  const description = `${matchup} MLB 경기의 선발투수, 최근 10경기, 불펜 피로도, 맞대결, 구종 분석과 AI 승리 확률 및 예상 스코어를 확인하세요.`;
  const query = canonicalQuery(params);
  const canonical = `${BASE_URL}/mlb-game${query ? `?${query}` : ""}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Sports AI",
      type: "article",
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function Page() {
  return <GameClient />;
}

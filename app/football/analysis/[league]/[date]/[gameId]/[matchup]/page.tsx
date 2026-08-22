import type { Metadata } from "next";
import Link from "next/link";
import AnalysisClient from "../../../../../../football-game/AnalysisClient";

type Props = {
  params: Promise<{ league: string; date: string; gameId: string; matchup: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const LEAGUE_NAMES: Record<string, string> = {
  epl: "프리미어리그",
  laliga: "라리가",
  bundesliga: "분데스리가",
  seriea: "세리에 A",
  ucl: "UEFA 챔피언스리그",
  uel: "UEFA 유로파리그",
  uecl: "UEFA 컨퍼런스리그",
  mls: "미국 MLS",
  kleague: "K리그1",
};

function teams(matchup: string) {
  const decoded = decodeURIComponent(matchup);
  const [home = "홈팀", away = "원정팀"] = decoded.split("-대-");
  return { home, away };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { league, date, matchup } = await params;
  const { home, away } = teams(matchup);
  const leagueName = LEAGUE_NAMES[league] || "축구";
  const title = `${home} 대 ${away} 경기 분석 · 상대전적 · 최근 성적`;
  const description = `${date} ${leagueName} ${home} 대 ${away} 경기의 최근 10경기, 홈·원정 성적, 상대전적과 주요 변수를 한국어로 비교합니다.`;
  const canonical = `/football/analysis/${league}/${date}/${encodeURIComponent((await params).gameId)}/${encodeURIComponent(`${home}-대-${away}`)}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, type: "article", locale: "ko_KR" },
    robots: { index: true, follow: true },
  };
}

export default async function FootballAnalysisPage({ params, searchParams }: Props) {
  const { league, date, gameId, matchup } = await params;
  const raw = await searchParams;
  const { home, away } = teams(matchup);
  const text = (key: string) => typeof raw[key] === "string" ? raw[key] as string : "";
  const leagueName = text("leagueName") || LEAGUE_NAMES[league] || "축구";
  const query = {
    league, leagueName, gameId, date, home, away,
    homeId: text("homeId"), awayId: text("awayId"),
    time: text("time"), venue: text("venue"),
  };
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${home} 대 ${away}`,
    startDate: date,
    homeTeam: { "@type": "SportsTeam", name: home },
    awayTeam: { "@type": "SportsTeam", name: away },
    sport: "Soccer",
    eventStatus: "https://schema.org/EventScheduled",
  };

  return <main className="min-h-screen bg-[#020817] px-5 py-10 text-white">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    <article className="mx-auto max-w-5xl">
      <Link href="/football" className="text-sm font-bold text-emerald-400">← 축구 경기 일정으로</Link>
      <header className="mt-6 rounded-3xl border border-slate-700 bg-[#0f172a] p-7">
        <p className="text-sm font-black text-emerald-400">{leagueName}</p>
        <p className="mt-2 text-sm text-slate-400">{date}{text("time") ? ` ${text("time")}` : ""}{text("venue") ? ` · ${text("venue")}` : ""}</p>
        <div className="mt-9 grid grid-cols-[1fr_auto_1fr] items-center text-center">
          <h1 className="text-2xl font-black">{home}</h1><span className="rounded-full border border-slate-600 px-4 py-3 font-black">VS</span><h2 className="text-2xl font-black">{away}</h2>
        </div>
        <p className="mt-7 leading-7 text-slate-300">두 팀의 최근 10경기 결과와 득점·실점 흐름, 홈·원정 성적, 직접 맞대결 기록을 같은 기준으로 비교합니다. 예측 수치는 결과를 보장하지 않으며 확인 가능한 기록이 부족한 경우 신뢰도를 낮춰 표시합니다.</p>
      </header>
      <AnalysisClient query={query} />
    </article>
  </main>;
}

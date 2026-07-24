"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { dataCacheUrl } from "./lib/client-data-cache";

type League = "KBO" | "MLB" | "NPB";
type BaseballGame = {
  league: League;
  gamePk?: number;
  date: string;
  time: string;
  away: string;
  home: string;
  stadium: string;
  awayStarter: string;
  homeStarter: string;
  awayStarterCode: string;
  homeStarterCode: string;
  awayTeamId?: number;
  homeTeamId?: number;
  status?: string;
  commenceTime?: string;
  awayApiName?: string;
  homeApiName?: string;
};
type GamesResponse = { success: boolean; games: BaseballGame[]; message?: string };

const dateButtons = [
  { label: "어제", offset: -1 },
  { label: "오늘", offset: 0 },
  { label: "내일", offset: 1 },
];

function getKoreaDate(offsetDays = 0) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function formatKoreanDate(date: string) {
  const [year, month, day] = date.split("-");
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

export default function Home() {
  const [league, setLeague] = useState<League>("KBO");
  const [selectedDate, setSelectedDate] = useState(() => getKoreaDate());
  const [games, setGames] = useState<BaseballGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function loadGames() {
      try {
        setLoading(true);
        setErrorMessage("");
        const endpoint = league === "KBO" ? "/api/kbo" : league === "MLB" ? "/api/mlb" : "/api/npb";
        const sourcePath = `${endpoint}?date=${encodeURIComponent(selectedDate)}`;
        const response = await fetch(dataCacheUrl(sourcePath, 300), { signal: controller.signal, cache: "no-store" });
        const data = (await response.json()) as GamesResponse;
        if (!response.ok || !data.success) throw new Error(data.message ?? `${league} 경기 일정을 불러오지 못했습니다.`);

        const loadedGames = Array.isArray(data.games) ? data.games : [];
        if (league === "MLB") {
          setGames(loadedGames);
          return;
        }

        const kboTeamCodes: Record<string, string> = {
          "KIA 타이거즈": "KIA", "삼성 라이온즈": "SAMSUNG", "LG 트윈스": "LG",
          "두산 베어스": "DOOSAN", "KT 위즈": "KT", "SSG 랜더스": "SSG",
          "롯데 자이언츠": "LOTTE", "한화 이글스": "HANWHA", "NC 다이노스": "NC",
          "키움 히어로즈": "KIWOOM",
        };

        const missingTeams = new Map<string, string>();
        for (const game of loadedGames) {
          if (!game.awayStarter) missingTeams.set(game.away, game.awayApiName || game.away);
          if (!game.homeStarter) missingTeams.set(game.home, game.homeApiName || game.home);
        }

        if (!missingTeams.size) {
          setGames(loadedGames);
          return;
        }

        const fallbackStarters = new Map<string, string>();
        await Promise.all([...missingTeams.entries()].map(async ([displayName, apiName]) => {
          try {
            const fallbackPath = league === "KBO"
              ? `/api/kbo/team-pitching?team=${encodeURIComponent(kboTeamCodes[displayName] || apiName)}`
              : `/api/npb/pitchers?team=${encodeURIComponent(displayName)}&season=${encodeURIComponent(selectedDate.slice(0, 4))}`;
            const fallbackResponse = await fetch(dataCacheUrl(fallbackPath, 600), {
              signal: controller.signal,
              cache: "no-store",
            });
            if (!fallbackResponse.ok) return;
            const fallbackData = await fallbackResponse.json();
            const name = league === "KBO"
              ? String(fallbackData?.pitchers?.[0]?.player ?? "")
              : String(fallbackData?.rotation?.[0]?.name ?? "");
            if (name) fallbackStarters.set(displayName, name);
          } catch {
            // 공식 선발이 비어 있을 때만 사용하는 보조값이므로 실패해도 일정은 그대로 표시합니다.
          }
        }));

        setGames(loadedGames.map((game) => ({
          ...game,
          awayStarter: game.awayStarter || fallbackStarters.get(game.away) || "",
          homeStarter: game.homeStarter || fallbackStarters.get(game.home) || "",
        })));
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setGames([]);
        setErrorMessage(error instanceof Error ? error.message : `${league} 경기 일정을 불러오지 못했습니다.`);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    loadGames();
    return () => controller.abort();
  }, [selectedDate, league]);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <Link href="/" className="text-2xl font-black tracking-tight">Sports AI</Link>
          <nav className="flex items-center gap-4 text-sm font-bold">
            {(["KBO", "MLB", "NPB"] as League[]).map((item) => (
              <button key={item} type="button" onClick={() => setLeague(item)} className={league === item ? "text-blue-400" : "text-slate-500 hover:text-white"}>{item}</button>
            ))}
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-10 md:py-14">
        <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-7 md:p-10">
          <p className="text-sm font-black tracking-widest text-blue-400">AI SPORTS ANALYSIS</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">오늘의 {league} 경기 분석</h1>
          <p className="mt-4 max-w-2xl leading-7 text-slate-400">
            {league === "KBO" ? "기존 KBO 일정과 분석 기능을 그대로 제공합니다." : league === "MLB" ? "MLB 팀 타격, 선발투수, 최근 경기, 상대전적, 불펜 피로도와 시장 배당을 분석합니다." : "NPB 공식 일정과 양대 리그 순위 데이터를 바탕으로 경기 전력을 분석합니다."}
          </p>
        </div>

        <div className="mt-8 flex gap-3 overflow-x-auto pb-2">
          {dateButtons.map((button) => {
            const buttonDate = getKoreaDate(button.offset);
            const selected = selectedDate === buttonDate;
            return <button key={button.label} type="button" onClick={() => setSelectedDate(buttonDate)} className={`min-w-24 rounded-full px-5 py-3 text-sm font-black transition ${selected ? "bg-blue-600 text-white" : "border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"}`}>{button.label}</button>;
          })}
        </div>

        <section className="mt-10">
          <div className="flex items-end justify-between gap-4">
            <div><p className="text-sm font-bold text-slate-500">{formatKoreanDate(selectedDate)} · 한국시간</p><h2 className="mt-1 text-2xl font-black">{league} 경기 일정</h2></div>
            <p className="shrink-0 text-sm font-bold text-slate-500">{loading ? "불러오는 중" : `${games.length}경기`}</p>
          </div>

          {loading && <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500"/><p className="mt-4 text-sm font-bold text-slate-400">경기 일정을 불러오는 중입니다.</p></div>}
          {!loading && errorMessage && <div className="mt-6 rounded-2xl border border-red-900 bg-red-950/40 p-8 text-center"><p className="font-black text-red-300">경기 일정을 불러오지 못했습니다.</p><p className="mt-2 text-sm text-red-400">{errorMessage}</p></div>}
          {!loading && !errorMessage && games.length === 0 && <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center"><p className="text-lg font-black">예정된 경기가 없습니다.</p><p className="mt-2 text-sm text-slate-500">다른 날짜를 선택해 주세요.</p></div>}

          {!loading && !errorMessage && games.length > 0 && <div className="mt-6 grid gap-5 md:grid-cols-2">
            {games.map((game) => {
              const pathname = game.league === "KBO" ? "/game" : game.league === "MLB" ? "/mlb-game" : "/npb-game";
              return <article key={`${game.league}-${game.gamePk ?? ""}-${game.date}-${game.time}-${game.away}-${game.home}`} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 transition hover:border-slate-600">
                <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4"><span className="rounded-full bg-blue-950 px-3 py-1 text-xs font-black text-blue-300">{game.league}</span><div className="text-right"><p className="text-sm font-black text-white">{game.time}</p><p className="mt-1 text-xs font-bold text-slate-500">{game.stadium || game.status || "경기장 미정"}</p></div></div>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 py-8">
                  <div className="text-center"><p className="text-xs font-bold text-slate-500">원정팀</p><h3 className="mt-3 text-lg font-black md:text-xl">{game.away}</h3><p className="mt-2 text-sm font-bold text-slate-400">선발 {game.awayStarter || "미정"}</p></div>
                  <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-black text-slate-500">VS</span>
                  <div className="text-center"><p className="text-xs font-bold text-blue-400">홈팀</p><h3 className="mt-3 text-lg font-black md:text-xl">{game.home}</h3><p className="mt-2 text-sm font-bold text-slate-400">선발 {game.homeStarter || "미정"}</p></div>
                </div>
                <div className="px-5 pb-5"><Link href={{ pathname, query: { league: game.league, gamePk: game.gamePk, date: game.date, time: game.time, away: game.away, home: game.home, awayTeamId: game.awayTeamId, homeTeamId: game.homeTeamId, stadium: game.stadium, awayStarter: game.awayStarter, homeStarter: game.homeStarter, awayStarterCode: game.awayStarterCode, homeStarterCode: game.homeStarterCode, awayApiName: game.awayApiName, homeApiName: game.homeApiName, commenceTime: game.commenceTime } }} className="block w-full rounded-xl bg-blue-600 py-3.5 text-center text-sm font-black transition hover:bg-blue-500">경기 분석 보기</Link></div>
              </article>;
            })}
          </div>}
        </section>
      </section>
      <footer className="mt-16 border-t border-slate-800"><div className="mx-auto max-w-6xl px-5 py-8 text-center text-xs text-slate-600">Sports AI의 분석은 참고용 정보이며 경기 결과를 보장하지 않습니다.</div></footer>
    </main>
  );
}

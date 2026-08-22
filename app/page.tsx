"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { dataCacheUrl } from "./lib/client-data-cache";
import { playerNameKo as mlbPlayerNameKo } from "./lib/mlb-ko";
import { playerNameKo as npbPlayerNameKo } from "./api/npb/_shared";

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
  awayStarterName?: string;
  homeStarterName?: string;
  awayPitcher?: string;
  homePitcher?: string;
  awayStarterCode: string;
  homeStarterCode: string;
  awayTeamId?: number;
  homeTeamId?: number;
  status?: string;
  commenceTime?: string;
  awayApiName?: string;
  homeApiName?: string;
};

type GamesResponse = {
  success: boolean;
  games: BaseballGame[];
  message?: string;
};

function starterDisplayName(league: League, name: string) {
  if (!name) return "미정";
  if (league === "MLB") return mlbPlayerNameKo(name) || name;
  if (league === "NPB") {
    // /api/npb가 이미 한국어로 변환한 이름은 다시 로마자 변환 함수에 넣으면
    // 빈 문자열이 되어 카드에는 `선발`만 남습니다. 한국어 이름은 그대로 표시하고,
    // 일본어/영문 원문일 때만 NPB 이름 변환을 적용합니다.
    if (/[가-힣]/.test(name)) return name;
    return npbPlayerNameKo(name) || name;
  }
  return name;
}

const dateButtons = [
  { label: "어제", offset: -1 },
  { label: "오늘", offset: 0 },
  { label: "내일", offset: 1 },
];

function getKoreaDate(offsetDays = 0) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + offsetDays);

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate(),
  ).padStart(2, "0")}`;
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

        const endpoint =
          league === "KBO" ? "/api/kbo" : league === "MLB" ? "/api/mlb" : "/api/npb";
        const nameVersion = league === "MLB" || league === "NPB" ? "&nameVersion=3" : "";
        const sourcePath = `${endpoint}?date=${encodeURIComponent(selectedDate)}${nameVersion}`;
        // KBO/NPB 예고 선발은 경기 당일까지 자주 갱신되므로 오래된 브라우저 캐시를 사용하지 않습니다.
        // MLB는 공식 probable pitcher API 응답을 5분만 재사용합니다.
        const requestUrl = league === "MLB" ? dataCacheUrl(sourcePath, 300) : sourcePath;
        const response = await fetch(requestUrl, {
          signal: controller.signal,
          cache: "no-store",
        });

        const data = (await response.json()) as GamesResponse;

        if (!response.ok || !data.success) {
          throw new Error(data.message ?? `${league} 경기 일정을 불러오지 못했습니다.`);
        }

        const loadedGames = Array.isArray(data.games)
          ? data.games.map((game) => ({
              ...game,
              // NPB 목록/상세 API에서 과거에 사용한 필드명이 달라도
              // 카드에서는 실제 선발 이름을 하나로 통일해 표시합니다.
              awayStarter:
                game.awayStarter || game.awayStarterName || game.awayPitcher || "",
              homeStarter:
                game.homeStarter || game.homeStarterName || game.homePitcher || "",
            }))
          : [];

        // 선발은 일정 API가 확인한 공식 예고 선발만 사용합니다.
        // 팀 투수 목록의 첫 번째 선수를 임의 선발로 넣지 않습니다.
        setGames(loadedGames);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;

        setGames([]);
        setErrorMessage(
          error instanceof Error ? error.message : `${league} 경기 일정을 불러오지 못했습니다.`,
        );
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
          <Link href="/" className="text-2xl font-black tracking-tight">
            장군 AI
          </Link>

          <nav className="flex items-center gap-4 text-sm font-bold">
            {(["KBO", "MLB", "NPB"] as League[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setLeague(item)}
                className={
                  league === item
                    ? "text-blue-400"
                    : "text-slate-500 hover:text-white"
                }
              >
                {item}
              </button>
            ))}
            <Link href="/football" className="text-emerald-400 hover:text-emerald-300">
              축구
            </Link>
            <Link href="/news" className="text-cyan-400 hover:text-cyan-300">
              스포츠 뉴스
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-10 md:py-14">
        <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-7 md:p-10">
          <p className="text-sm font-black tracking-widest text-blue-400">
            AI SPORTS ANALYSIS
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">
            오늘의 {league} 경기 분석
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-slate-400">
            {league === "KBO"
              ? "기존 KBO 일정과 분석 기능을 그대로 제공합니다."
              : league === "MLB"
                ? "MLB 팀 타격, 선발투수, 최근 경기, 상대전적과 불펜 피로도를 분석합니다."
                : "NPB 공식 일정과 양대 리그 순위 데이터를 바탕으로 경기 전력을 분석합니다."}
          </p>
        </div>

        <div className="mt-8 flex gap-3 overflow-x-auto pb-2">
          {dateButtons.map((button) => {
            const buttonDate = getKoreaDate(button.offset);
            const selected = selectedDate === buttonDate;

            return (
              <button
                key={button.label}
                type="button"
                onClick={() => setSelectedDate(buttonDate)}
                className={`min-w-24 rounded-full px-5 py-3 text-sm font-black transition ${
                  selected
                    ? "bg-blue-600 text-white"
                    : "border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"
                }`}
              >
                {button.label}
              </button>
            );
          })}
        </div>

        <section className="mt-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-slate-500">
                {formatKoreanDate(selectedDate)} · 한국시간
              </p>
              <h2 className="mt-1 text-2xl font-black">{league} 경기 일정</h2>
            </div>
            <p className="shrink-0 text-sm font-bold text-slate-500">
              {loading ? "불러오는 중" : `${games.length}경기`}
            </p>
          </div>

          {loading && (
            <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />
              <p className="mt-4 text-sm font-bold text-slate-400">
                경기 일정을 불러오는 중입니다.
              </p>
            </div>
          )}

          {!loading && errorMessage && (
            <div className="mt-6 rounded-2xl border border-red-900 bg-red-950/40 p-8 text-center">
              <p className="font-black text-red-300">
                경기 일정을 불러오지 못했습니다.
              </p>
              <p className="mt-2 text-sm text-red-400">{errorMessage}</p>
            </div>
          )}

          {!loading && !errorMessage && games.length === 0 && (
            <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
              <p className="text-lg font-black">예정된 경기가 없습니다.</p>
              <p className="mt-2 text-sm text-slate-500">
                다른 날짜를 선택해 주세요.
              </p>
            </div>
          )}

          {!loading && !errorMessage && games.length > 0 && (
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {games.map((game) => {
                const matchupSlug = `${encodeURIComponent(game.away)}-vs-${encodeURIComponent(game.home)}`;
                const pathname = `/analysis/${game.league.toLowerCase()}/${game.date}/${matchupSlug}`;

                return (
                  <article
                    key={`${game.league}-${game.gamePk ?? ""}-${game.date}-${game.time}-${game.away}-${game.home}`}
                    className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 transition hover:border-slate-600"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
                      <span className="rounded-full bg-blue-950 px-3 py-1 text-xs font-black text-blue-300">
                        {game.league}
                      </span>
                      <div className="text-right">
                        <p className="text-sm font-black text-white">{game.time}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">
                          {game.stadium || game.status || "경기장 미정"}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 py-8">
                      <div className="text-center">
                        <p className="text-xs font-bold text-slate-500">원정팀</p>
                        <h3 className="mt-3 text-lg font-black md:text-xl">
                          {game.away}
                        </h3>
                        <p className="mt-2 text-sm font-bold text-slate-400">
                          {game.status === "Canceled" ? "경기 취소" : `선발 ${starterDisplayName(game.league, game.awayStarter)}`}
                        </p>
                      </div>

                      <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-black text-slate-500">
                        VS
                      </span>

                      <div className="text-center">
                        <p className="text-xs font-bold text-blue-400">홈팀</p>
                        <h3 className="mt-3 text-lg font-black md:text-xl">
                          {game.home}
                        </h3>
                        <p className="mt-2 text-sm font-bold text-slate-400">
                          {game.status === "Canceled" ? "경기 취소" : `선발 ${starterDisplayName(game.league, game.homeStarter)}`}
                        </p>
                      </div>
                    </div>

                    <div className="px-5 pb-5">
                      <Link
                        href={{
                          pathname,
                          query: {
                            league: game.league,
                            gamePk: game.gamePk,
                            date: game.date,
                            time: game.time,
                            away: game.away,
                            home: game.home,
                            awayTeamId: game.awayTeamId,
                            homeTeamId: game.homeTeamId,
                            stadium: game.stadium,
                            awayStarter: game.awayStarter,
                            homeStarter: game.homeStarter,
                            awayStarterCode: game.awayStarterCode,
                            homeStarterCode: game.homeStarterCode,
                            awayApiName: game.awayApiName,
                            homeApiName: game.homeApiName,
                            commenceTime: game.commenceTime,
                          },
                        }}
                        className="block w-full rounded-xl bg-blue-600 py-3.5 text-center text-sm font-black transition hover:bg-blue-500"
                      >
                        경기 분석 보기
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>

      <footer className="mt-16 border-t border-slate-800">
        <div className="mx-auto max-w-6xl px-5 py-8 text-center">
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm font-bold text-slate-400">
            <Link href="/about" className="hover:text-white">
              사이트 소개
            </Link>
            <Link href="/privacy" className="hover:text-white">
              개인정보처리방침
            </Link>
            <Link href="/terms" className="hover:text-white">
              이용약관
            </Link>
            <Link href="/contact" className="hover:text-white">
              문의하기
            </Link>
          </nav>

          <p className="mt-5 text-xs text-slate-600">
            장군 AI의 분석은 참고용 정보이며 경기 결과를 보장하지 않습니다.
          </p>
          <p className="mt-2 text-xs text-slate-600">© 2026 장군 AI</p>
        </div>
      </footer>
    </main>
  );
}

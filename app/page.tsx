"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type KboGame = {
  league: "KBO";
  date: string;
  time: string;
  away: string;
  home: string;
  stadium: string;
};

type KboResponse = {
  success: boolean;
  date?: string;
  count?: number;
  games: KboGame[];
  message?: string;
};

const dateButtons = [
  { label: "어제", offset: -1 },
  { label: "오늘", offset: 0 },
  { label: "내일", offset: 1 },
];

function getKoreaDate(offsetDays = 0) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(new Date());

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  const koreaDate = new Date(Date.UTC(year, month - 1, day));
  koreaDate.setUTCDate(koreaDate.getUTCDate() + offsetDays);

  return [
    koreaDate.getUTCFullYear(),
    String(koreaDate.getUTCMonth() + 1).padStart(2, "0"),
    String(koreaDate.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function formatKoreanDate(date: string) {
  const [year, month, day] = date.split("-");

  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

export default function Home() {
  const [selectedDate, setSelectedDate] = useState(() => getKoreaDate());
  const [games, setGames] = useState<KboGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadGames() {
      try {
        setLoading(true);
        setErrorMessage("");

        const response = await fetch(
          `/api/kbo?date=${encodeURIComponent(selectedDate)}`,
          {
            signal: controller.signal,
            cache: "no-store",
          },
        );

        const data = (await response.json()) as KboResponse;

        if (!response.ok || !data.success) {
          throw new Error(
            data.message ?? "KBO 경기 일정을 불러오지 못했습니다.",
          );
        }

        setGames(Array.isArray(data.games) ? data.games : []);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        console.error("KBO 일정 불러오기 오류:", error);

        setGames([]);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "KBO 경기 일정을 불러오지 못했습니다.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadGames();

    return () => {
      controller.abort();
    };
  }, [selectedDate]);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <Link href="/" className="text-2xl font-black tracking-tight">
            Sports AI
          </Link>

          <nav className="flex items-center gap-4 text-sm font-bold">
            <button type="button" className="text-blue-400">
              KBO
            </button>

            <button
              type="button"
              disabled
              className="cursor-not-allowed text-slate-600"
            >
              NPB
            </button>

            <button
              type="button"
              disabled
              className="cursor-not-allowed text-slate-600"
            >
              MLB
            </button>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-10 md:py-14">
        <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-7 md:p-10">
          <p className="text-sm font-black tracking-widest text-blue-400">
            AI SPORTS ANALYSIS
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">
            오늘의 KBO 경기 분석
          </h1>

          <p className="mt-4 max-w-2xl leading-7 text-slate-400">
            KBO 경기 일정과 팀 기록을 바탕으로 경기별 분석 정보를
            제공합니다.
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
                {formatKoreanDate(selectedDate)}
              </p>

              <h2 className="mt-1 text-2xl font-black">KBO 경기 일정</h2>
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
                어제 또는 내일 날짜를 선택해 주세요.
              </p>
            </div>
          )}

          {!loading && !errorMessage && games.length > 0 && (
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {games.map((game) => (
                <article
                  key={`${game.date}-${game.time}-${game.away}-${game.home}`}
                  className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 transition hover:border-slate-600"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
                    <span className="rounded-full bg-blue-950 px-3 py-1 text-xs font-black text-blue-300">
                      {game.league}
                    </span>

                    <div className="text-right">
                      <p className="text-sm font-black text-white">
                        {game.time}
                      </p>

                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {game.stadium}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 py-8">
                    <div className="text-center">
                      <p className="text-xs font-bold text-slate-500">원정팀</p>

                      <h3 className="mt-3 text-lg font-black md:text-xl">
                        {game.away}
                      </h3>
                    </div>

                    <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-black text-slate-500">
                      VS
                    </span>

                    <div className="text-center">
                      <p className="text-xs font-bold text-blue-400">홈팀</p>

                      <h3 className="mt-3 text-lg font-black md:text-xl">
                        {game.home}
                      </h3>
                    </div>
                  </div>

                  <div className="px-5 pb-5">
                    <Link
                      href={{
                        pathname: "/game",
                        query: {
                          league: game.league,
                          date: game.date,
                          time: game.time,
                          away: game.away,
                          home: game.home,
                          stadium: game.stadium,
                        },
                      }}
                      className="block w-full rounded-xl bg-blue-600 py-3.5 text-center text-sm font-black transition hover:bg-blue-500"
                    >
                      경기 분석 보기
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      <footer className="mt-16 border-t border-slate-800">
        <div className="mx-auto max-w-6xl px-5 py-8 text-center text-xs text-slate-600">
          Sports AI의 분석은 참고용 정보이며 경기 결과를 보장하지 않습니다.
        </div>
      </footer>
    </main>
  );
}
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type League = "KBO" | "NPB" | "MLB";
type DbResult = "hit" | "miss" | "draw" | "pending";

type Row = {
  id: number;
  league: League;
  game_date: string;
  away_team: string;
  home_team: string;
  predicted_winner: string | null;
  confidence: number | null;
  away_win_probability: number | null;
  home_win_probability: number | null;
  actual_score_away: number | null;
  actual_score_home: number | null;
  result: DbResult;
  created_at: string;
};

const PASSWORD = "2580";

function labelResult(result: DbResult) {
  if (result === "hit") return "적중";
  if (result === "miss") return "미적중";
  if (result === "draw") return "무승부";
  return "결과대기";
}

function resultColor(result: DbResult) {
  if (result === "hit") return "text-emerald-400";
  if (result === "miss") return "text-red-400";
  if (result === "draw") return "text-slate-300";
  return "text-amber-300";
}

function confidenceBand(value: number | null) {
  const score = Number(value ?? 0);
  if (score >= 80) return "80~100 매우 높음";
  if (score >= 65) return "65~79 높음";
  if (score >= 50) return "50~64 보통";
  return "50 미만";
}

function calc(rows: Row[]) {
  const decided = rows.filter((row) => row.result === "hit" || row.result === "miss");
  const wins = decided.filter((row) => row.result === "hit").length;
  const losses = decided.filter((row) => row.result === "miss").length;
  return {
    total: rows.length,
    wins,
    losses,
    draws: rows.filter((row) => row.result === "draw").length,
    pending: rows.filter((row) => row.result === "pending").length,
    rate: decided.length ? (wins / decided.length) * 100 : null,
  };
}

export default function AdminStatsPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedDate, setSelectedDate] = useState("전체");
  const [selectedLeague, setSelectedLeague] = useState<"전체" | League>("전체");
  const [selectedConfidence, setSelectedConfidence] = useState("전체");

  useEffect(() => {
    setUnlocked(sessionStorage.getItem("sports-ai-owner") === "ok");
  }, []);

  async function loadRows() {
    setLoading(true);
    try {
      const response = await fetch("/api/predictions?list=1", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.message || "DB 기록을 불러오지 못했습니다.");
      setRows(Array.isArray(json.rows) ? json.rows : []);
      setMessage(`DB 예측 기록 ${Array.isArray(json.rows) ? json.rows.length : 0}건을 불러왔습니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "DB 기록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function updateResults() {
    setUpdating(true);
    setMessage("");
    try {
      const response = await fetch("/api/predictions/results", { method: "POST", headers: { "x-admin-password": PASSWORD } });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || "결과 업데이트에 실패했습니다.");
      setMessage(`결과 확인 ${json.checked}건 · 새 판정 ${json.updated}건 · 결과대기 ${json.pending}건`);
      await loadRows();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "결과 업데이트에 실패했습니다.");
    } finally {
      setUpdating(false);
    }
  }

  useEffect(() => {
    if (unlocked) void loadRows();
  }, [unlocked]);

  const dates = useMemo(
    () => ["전체", ...Array.from(new Set(rows.map((row) => row.game_date))).sort((a, b) => b.localeCompare(a))],
    [rows],
  );

  const confidenceBands = ["전체", "80~100 매우 높음", "65~79 높음", "50~64 보통", "50 미만"];

  const visibleRows = useMemo(
    () =>
      rows.filter((row) => {
        if (selectedDate !== "전체" && row.game_date !== selectedDate) return false;
        if (selectedLeague !== "전체" && row.league !== selectedLeague) return false;
        if (selectedConfidence !== "전체" && confidenceBand(row.confidence) !== selectedConfidence) return false;
        return true;
      }),
    [rows, selectedDate, selectedLeague, selectedConfidence],
  );

  const leagueStats = useMemo(
    () => ({
      ALL: calc(rows),
      KBO: calc(rows.filter((row) => row.league === "KBO")),
      NPB: calc(rows.filter((row) => row.league === "NPB")),
      MLB: calc(rows.filter((row) => row.league === "MLB")),
    }),
    [rows],
  );

  const confidenceStats = useMemo(
    () => confidenceBands.slice(1).map((band) => ({ band, ...calc(rows.filter((row) => confidenceBand(row.confidence) === band)) })),
    [rows],
  );

  if (!unlocked) {
    return (
      <main className="min-h-screen bg-slate-950 px-5 py-20 text-white">
        <div className="mx-auto max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-7">
          <p className="text-sm font-black text-blue-400">OWNER ONLY</p>
          <h1 className="mt-3 text-3xl font-black">관리자 적중률</h1>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && password === PASSWORD) {
                sessionStorage.setItem("sports-ai-owner", "ok");
                setUnlocked(true);
              }
            }}
            placeholder="비밀번호"
            className="mt-6 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none"
          />
          <button
            type="button"
            onClick={() => {
              if (password === PASSWORD) {
                sessionStorage.setItem("sports-ai-owner", "ok");
                setUnlocked(true);
              } else {
                setMessage("비밀번호가 다릅니다.");
              }
            }}
            className="mt-3 w-full rounded-xl bg-blue-600 py-3 font-black"
          >
            확인
          </button>
          {message && <p className="mt-3 text-sm text-red-300">{message}</p>}
          <Link href="/" className="mt-5 block text-center text-sm font-bold text-slate-400">← 홈으로</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <Link href="/" className="text-2xl font-black">Sports AI</Link>
          <button onClick={() => { sessionStorage.removeItem("sports-ai-owner"); setUnlocked(false); }} className="text-sm font-black text-slate-400">잠금</button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-10">
        <p className="text-sm font-black text-blue-400">OWNER ONLY</p>
        <h1 className="mt-2 text-3xl font-black">DB 실제 예측 적중률</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">경기 전에 최초 저장된 추천만 집계합니다. 같은 경기를 다시 분석해도 최초 추천은 바뀌지 않습니다.</p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button onClick={() => void updateResults()} disabled={updating} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black disabled:opacity-50">{updating ? "결과 확인 중..." : "종료 경기 결과 업데이트"}</button>
          <button onClick={() => void loadRows()} disabled={loading} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black disabled:opacity-50">{loading ? "불러오는 중..." : "DB 다시 불러오기"}</button>
          {message && <p className="text-sm text-slate-400">{message}</p>}
        </div>

        <div className="mt-8 grid gap-3 md:grid-cols-4">
          {Object.entries(leagueStats).map(([key, value]) => (
            <div key={key} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm font-black text-slate-500">{key === "ALL" ? "전체" : key}</p>
              <p className="mt-3 text-3xl font-black text-blue-400">{value.rate == null ? "-" : `${value.rate.toFixed(1)}%`}</p>
              <p className="mt-2 text-sm text-slate-400">{value.wins}적중 · {value.losses}미적중</p>
              <p className="mt-1 text-xs text-slate-500">{value.draws}무승부 · {value.pending}결과대기 · 총 {value.total}경기</p>
            </div>
          ))}
        </div>

        <h2 className="mt-10 text-xl font-black">신뢰도별 적중률</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {confidenceStats.map((value) => (
            <div key={value.band} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm font-black text-slate-500">{value.band}</p>
              <p className="mt-3 text-2xl font-black text-blue-400">{value.rate == null ? "-" : `${value.rate.toFixed(1)}%`}</p>
              <p className="mt-2 text-xs text-slate-500">{value.wins}적중 · {value.losses}미적중 · {value.pending}대기</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {(["전체", "KBO", "NPB", "MLB"] as const).map((league) => (
            <button key={league} onClick={() => setSelectedLeague(league)} className={`rounded-xl px-4 py-2 text-sm font-black ${selectedLeague === league ? "bg-blue-600" : "border border-slate-700 bg-slate-900 text-slate-400"}`}>{league}</button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {confidenceBands.map((band) => (
            <button key={band} onClick={() => setSelectedConfidence(band)} className={`rounded-xl px-4 py-2 text-sm font-black ${selectedConfidence === band ? "bg-blue-600" : "border border-slate-700 bg-slate-900 text-slate-400"}`}>{band}</button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {dates.map((date) => (
            <button key={date} onClick={() => setSelectedDate(date)} className={`rounded-xl px-4 py-2 text-sm font-black ${selectedDate === date ? "bg-blue-600" : "border border-slate-700 bg-slate-900 text-slate-400"}`}>{date}</button>
          ))}
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 px-5 py-4 font-black">실제 예측 기록 {visibleRows.length}건</div>
          {visibleRows.length === 0 ? (
            <div className="p-10 text-center text-slate-500">아직 저장된 예측이 없습니다. 오늘 또는 미래 경기 분석 화면을 열어 주세요.</div>
          ) : (
            <div className="divide-y divide-slate-800">
              {visibleRows.map((row) => (
                <div key={row.id} className="grid gap-3 px-5 py-4 md:grid-cols-[90px_1fr_1fr_110px]">
                  <div><span className="rounded-full bg-blue-950 px-2.5 py-1 text-xs font-black text-blue-300">{row.league}</span><p className="mt-2 text-xs text-slate-500">{row.game_date}</p></div>
                  <div><p className="font-black">{row.away_team} 대 {row.home_team}</p><p className="mt-1 text-sm text-slate-500">최종 점수: {row.actual_score_away != null && row.actual_score_home != null ? `${row.actual_score_away} : ${row.actual_score_home}` : "결과대기"}</p></div>
                  <div><p className="text-xs font-bold text-slate-500">최초 AI 추천 · 신뢰도 {Number(row.confidence ?? 0).toFixed(0)}점</p><p className="mt-1 font-black text-blue-300">{row.predicted_winner} 승</p><p className="mt-1 text-xs text-slate-500">원정 {Number(row.away_win_probability ?? 0).toFixed(1)}% · 홈 {Number(row.home_win_probability ?? 0).toFixed(1)}%</p></div>
                  <div className={`font-black ${resultColor(row.result)}`}>{labelResult(row.result)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

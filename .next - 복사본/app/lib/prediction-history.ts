"use client";

export type PredictionLeague = "KBO" | "MLB" | "NPB";
export type PredictionResult = "적중" | "미적중" | "무승부" | "결과대기";

export type SavedPrediction = {
  id: string;
  league: PredictionLeague;
  date: string;
  time?: string;
  away: string;
  home: string;
  pick: string;
  awayRate: number;
  homeRate: number;
  confidence: number;
  createdAt: string;
  source: "실제 예측";
  result: PredictionResult;
  awayScore?: number;
  homeScore?: number;
};

export const PREDICTION_HISTORY_KEY = "sports-ai-real-predictions-v1";

function clampRate(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, number));
}

/**
 * 기존 관리자 화면과의 타입 호환을 위해 남겨 둔 함수입니다.
 * 신규 예측은 더 이상 브라우저 localStorage에 저장하지 않습니다.
 */
export function readPredictionHistory(): SavedPrediction[] {
  return [];
}

/** 신규 예측은 서버 DB만 사용하므로 localStorage 쓰기는 수행하지 않습니다. */
export function writePredictionHistory(_rows: SavedPrediction[]) {
  return;
}

/**
 * KBO·NPB·MLB 경기 화면에서 공통으로 호출합니다.
 * 서버 API가 과거 경기 차단, 최초 추천 고정, 중복 방지를 처리합니다.
 */
export function savePregamePrediction(
  input: Omit<SavedPrediction, "id" | "createdAt" | "source" | "result">
) {
  if (typeof window === "undefined") return;
  if (!input.date || !input.away || !input.home || !input.pick) return;

  const payload = {
    league: input.league,
    date: input.date,
    time: input.time ?? "",
    away: input.away.trim(),
    home: input.home.trim(),
    pick: input.pick.trim(),
    awayRate: clampRate(input.awayRate),
    homeRate: clampRate(input.homeRate),
    confidence: clampRate(input.confidence),
  };

  void fetch("/api/predictions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch((error) => {
    console.error("예측 DB 저장 요청 실패", error);
  });
}

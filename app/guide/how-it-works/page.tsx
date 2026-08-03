import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AI 야구 분석 기준",
  description: "장군 AI가 선발투수, 타선, 상대전적, 불펜 피로도와 홈·원정 기록을 비교해 경기 분석을 구성하는 방법을 설명합니다.",
  alternates: { canonical: "/guide/how-it-works" },
};

export default function Page() {
  return <main className="min-h-screen bg-slate-950 px-5 py-12 text-white"><article className="mx-auto max-w-3xl">
    <Link href="/" className="text-sm font-black text-blue-400">← 장군 AI 홈</Link>
    <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-7 sm:p-10">
      <p className="text-sm font-black text-blue-400">ANALYSIS METHOD</p><h1 className="mt-3 text-3xl font-black">AI 야구 분석 기준</h1>
      <div className="mt-8 space-y-8 leading-8 text-slate-300">
        <section><h2 className="text-xl font-black text-white">1. 선발투수의 기본 능력과 최근 상태</h2><p className="mt-3">시즌 평균자책점만으로 선발을 판단하지 않습니다. 이닝 소화력, WHIP, 볼넷과 탈삼진, 최근 등판의 투구 수와 실점 흐름을 함께 확인합니다. 같은 평균자책점이라도 출루 허용이 많거나 최근 구위가 떨어졌다면 위험 요소가 커질 수 있습니다.</p></section>
        <section><h2 className="text-xl font-black text-white">2. 팀 타선의 현재 득점력</h2><p className="mt-3">시즌 전체 성적과 최근 경기 성적을 분리해 봅니다. 최근 득점, 출루율, 장타율과 좌·우 투수 상대 성적을 비교하면 해당 경기의 선발 유형을 상대로 어느 팀이 더 유리한지 판단하는 데 도움이 됩니다.</p></section>
        <section><h2 className="text-xl font-black text-white">3. 맞대결과 홈·원정 차이</h2><p className="mt-3">최근 맞대결은 팀 스타일과 구장 환경이 실제 결과에 어떻게 반영됐는지 보여줍니다. 다만 과거 전적만으로 결론을 내리지 않고 현재 선발과 타선 상태를 함께 확인합니다.</p></section>
        <section><h2 className="text-xl font-black text-white">4. 불펜 피로도와 경기 후반</h2><p className="mt-3">불펜은 전날 투구 수, 최근 3일 누적 투구량, 연속 등판 여부에 따라 경기력이 달라질 수 있습니다. 선발이 비슷한 경기에서는 후반 불펜 운용 가능성이 중요한 차이를 만듭니다.</p></section>
        <section><h2 className="text-xl font-black text-white">5. 예측의 한계</h2><p className="mt-3">야구는 작은 표본과 돌발 변수가 큰 종목입니다. 수비 실책, 갑작스러운 라인업 변경, 날씨와 심판 성향 등은 사전에 완전히 반영할 수 없습니다. 장군 AI의 승률과 예상 점수는 경기 정보를 비교하기 위한 참고 자료이며 결과를 보장하지 않습니다.</p></section>
      </div>
    </div>
  </article></main>;
}

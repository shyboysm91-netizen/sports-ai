"use client";

import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-5 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-black text-blue-400">← Sports AI 홈</Link>

        <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-7 sm:p-10">
          <p className="text-sm font-black text-blue-400">ABOUT SPORTS AI</p>
          <h1 className="mt-3 text-3xl font-black">사이트 소개</h1>

          <div className="mt-7 space-y-6 text-sm leading-7 text-slate-300">
            <p>
              Sports AI는 KBO, MLB, NPB 야구 경기를 데이터 기반으로 분석하여
              경기 일정, 팀 성적, 선발투수 기록, 최근 경기 흐름, 맞대결, 불펜 상태,
              구종 정보 및 AI 예측 정보를 제공하는 스포츠 분석 서비스입니다.
            </p>

            <p>
              제공되는 분석은 공개된 경기 기록과 통계 데이터를 바탕으로 구성되며,
              사용자가 여러 정보를 한눈에 비교할 수 있도록 정리하는 것을 목표로 합니다.
            </p>

            <p>
              Sports AI의 모든 예측과 분석 결과는 참고용 정보이며 실제 경기 결과를
              보장하지 않습니다. 경기 당일 선발 변경, 부상, 라인업 및 현장 상황에 따라
              실제 결과는 달라질 수 있습니다.
            </p>

            <div className="rounded-2xl bg-slate-950 p-5">
              <p className="font-black text-white">제공 리그</p>
              <p className="mt-2">KBO · MLB · NPB</p>
            </div>

            <p>
              서비스 관련 문의 및 제휴 문의는{" "}
              <a className="font-bold text-blue-400" href="mailto:shyboysm91@gmail.com">
                shyboysm91@gmail.com
              </a>
              으로 보내주세요.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

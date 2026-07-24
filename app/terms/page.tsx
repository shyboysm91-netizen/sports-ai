"use client";

import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-5 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-black text-blue-400">← Sports AI 홈</Link>

        <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-7 sm:p-10">
          <p className="text-sm font-black text-blue-400">TERMS OF USE</p>
          <h1 className="mt-3 text-3xl font-black">이용약관</h1>
          <p className="mt-3 text-sm text-slate-500">시행일: 2026년 7월 24일</p>

          <div className="mt-8 space-y-7 text-sm leading-7 text-slate-300">
            <section>
              <h2 className="text-lg font-black text-white">1. 목적</h2>
              <p className="mt-2">
                본 약관은 Sports AI가 제공하는 야구 경기 정보 및 분석 서비스 이용에 관한
                기본 조건을 정하는 것을 목적으로 합니다.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-black text-white">2. 서비스 내용</h2>
              <p className="mt-2">
                Sports AI는 KBO, MLB, NPB 경기 일정, 통계, 선발투수, 최근 경기,
                맞대결, 불펜 및 AI 분석 정보를 제공합니다.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-black text-white">3. 정보의 성격</h2>
              <p className="mt-2">
                사이트에서 제공하는 모든 분석, 확률 및 추천 정보는 참고용이며 실제 경기
                결과를 보장하지 않습니다. 이용자는 자신의 판단과 책임으로 정보를 이용해야 합니다.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-black text-white">4. 서비스 변경 및 중단</h2>
              <p className="mt-2">
                데이터 제공처의 장애, 점검, 통신 문제 또는 운영상 필요에 따라 일부 정보가
                지연되거나 서비스가 변경 또는 일시 중단될 수 있습니다.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-black text-white">5. 금지 행위</h2>
              <p className="mt-2">
                이용자는 서비스에 비정상적인 부하를 주는 행위, 무단 복제 및 재배포,
                시스템 접근 방해, 불법적인 목적으로 정보를 이용하는 행위를 해서는 안 됩니다.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-black text-white">6. 저작권</h2>
              <p className="mt-2">
                사이트의 구성, 디자인, 자체 작성된 분석 문구와 콘텐츠에 대한 권리는
                Sports AI에 있습니다. 경기 기록과 팀·선수 관련 권리는 각 권리자에게 있습니다.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-black text-white">7. 책임의 제한</h2>
              <p className="mt-2">
                Sports AI는 제공된 정보를 이용해 발생한 직접 또는 간접 손실에 대해 법령상
                허용되는 범위에서 책임을 지지 않습니다.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-black text-white">8. 문의</h2>
              <p className="mt-2">
                이용약관 관련 문의:{" "}
                <a className="font-bold text-blue-400" href="mailto:shyboysm91@gmail.com">
                  shyboysm91@gmail.com
                </a>
              </p>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

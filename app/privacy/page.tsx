"use client";

import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-5 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-black text-blue-400">← Sports AI 홈</Link>

        <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-7 sm:p-10">
          <p className="text-sm font-black text-blue-400">PRIVACY POLICY</p>
          <h1 className="mt-3 text-3xl font-black">개인정보처리방침</h1>
          <p className="mt-3 text-sm text-slate-500">시행일: 2026년 7월 24일</p>

          <div className="mt-8 space-y-7 text-sm leading-7 text-slate-300">
            <section>
              <h2 className="text-lg font-black text-white">1. 개인정보의 수집</h2>
              <p className="mt-2">
                Sports AI는 별도의 회원가입 기능을 운영하지 않는 경우 방문자의 이름,
                전화번호 등 개인을 직접 식별하는 정보를 자동으로 수집하지 않습니다.
                문의 이메일을 보내는 경우 이메일 주소와 문의 내용이 수집될 수 있습니다.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-black text-white">2. 수집 정보의 이용 목적</h2>
              <p className="mt-2">
                문의에 대한 답변, 서비스 개선, 오류 확인, 광고 및 제휴 문의 처리를 위해
                필요한 범위에서 정보를 이용할 수 있습니다.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-black text-white">3. 쿠키 및 로그 정보</h2>
              <p className="mt-2">
                서비스 품질 개선과 방문 통계 확인을 위해 브라우저 쿠키, 접속 시간,
                이용 기기 및 페이지 방문 기록과 같은 비식별 정보가 처리될 수 있습니다.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-black text-white">4. Google 광고 및 분석 서비스</h2>
              <p className="mt-2">
                향후 Google AdSense 또는 Google Analytics와 같은 서비스를 사용할 수
                있습니다. Google을 포함한 제3자 사업자는 쿠키를 사용해 이전 방문 기록을
                바탕으로 광고를 제공하거나 이용 통계를 분석할 수 있습니다.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-black text-white">5. 개인정보의 보관 및 삭제</h2>
              <p className="mt-2">
                문의 처리에 필요한 정보는 목적 달성 후 관련 법령에서 별도 보관을 요구하지
                않는 한 지체 없이 삭제합니다.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-black text-white">6. 외부 링크</h2>
              <p className="mt-2">
                Sports AI는 외부 사이트로 연결되는 링크를 제공할 수 있으며, 외부 사이트의
                개인정보 처리 방식에 대해서는 책임지지 않습니다.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-black text-white">7. 문의</h2>
              <p className="mt-2">
                개인정보 관련 문의:{" "}
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

"use client";

import Link from "next/link";

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-5 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-black text-blue-400">← Sports AI 홈</Link>

        <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-7 sm:p-10">
          <p className="text-sm font-black text-blue-400">CONTACT</p>
          <h1 className="mt-3 text-3xl font-black">문의하기</h1>

          <div className="mt-7 space-y-6 text-sm leading-7 text-slate-300">
            <p>
              Sports AI 서비스 오류, 데이터 문의, 광고 및 제휴 문의는 아래 이메일로
              보내주세요.
            </p>

            <a
              href="mailto:shyboysm91@gmail.com?subject=Sports%20AI%20문의"
              className="block rounded-2xl border border-blue-800 bg-blue-950/30 p-6 transition hover:border-blue-500"
            >
              <p className="text-xs font-black text-blue-400">문의 이메일</p>
              <p className="mt-2 break-all text-xl font-black text-white">
                shyboysm91@gmail.com
              </p>
            </a>

            <div className="rounded-2xl bg-slate-950 p-5">
              <p className="font-black text-white">문의 시 포함하면 좋은 내용</p>
              <p className="mt-3">• 문제가 발생한 리그 및 경기</p>
              <p>• 발생한 날짜와 시간</p>
              <p>• 오류 화면 또는 증상</p>
              <p>• 광고·제휴 문의의 경우 회사명과 제안 내용</p>
            </div>

            <p className="text-slate-500">
              문의 내용에 따라 답변까지 시간이 걸릴 수 있습니다.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

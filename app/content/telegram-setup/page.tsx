"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type CheckResult = {
  success?: boolean;
  configured?: boolean;
  bot?: boolean;
  chat?: boolean;
  siteUrl?: boolean;
  botName?: string;
  chatName?: string;
  message?: string;
};

export default function TelegramSetupPage() {
  const [result, setResult] = useState<CheckResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");

  async function check() {
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch("/api/content/telegram/check", { cache: "no-store" });
      setResult(await response.json());
    } catch {
      setResult({ success: false, message: "연결 상태를 확인하지 못했습니다." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void check(); }, []);

  async function sendTest() {
    setSending(true);
    setNotice("테스트 메시지를 보내는 중입니다.");
    try {
      const response = await fetch("/api/content/telegram/test", { method: "POST" });
      const json = await response.json();
      setNotice(json.message || (response.ok ? "전송 완료" : "전송 실패"));
    } catch {
      setNotice("테스트 메시지 전송에 실패했습니다.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-sm font-black text-sky-400">TELEGRAM BOT</p><h1 className="mt-2 text-3xl font-black">텔레그램 발행 연결</h1></div>
          <Link href="/content" className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-black">← 콘텐츠 화면</Link>
        </div>

        <section className="mt-7 rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <div className={`rounded-xl p-4 font-black ${result?.success ? "bg-emerald-950 text-emerald-300" : "bg-amber-950 text-amber-300"}`}>
            {loading ? "연결 상태 확인 중..." : result?.message || "설정 상태를 확인하세요."}
          </div>
          {result?.success && <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-slate-950 p-4"><p className="text-xs text-slate-500">연결된 봇</p><p className="mt-1 font-black">{result.botName || "확인됨"}</p></div><div className="rounded-xl bg-slate-950 p-4"><p className="text-xs text-slate-500">전송 대상</p><p className="mt-1 font-black">{result.chatName || "확인됨"}</p></div></div>}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={check} disabled={loading} className="rounded-xl border border-slate-700 px-4 py-3 font-black disabled:opacity-50">연결 다시 확인</button>
            <button type="button" onClick={sendTest} disabled={sending || !result?.success} className="rounded-xl bg-sky-600 px-4 py-3 font-black disabled:opacity-40">{sending ? "전송 중..." : "테스트 메시지 보내기"}</button>
          </div>
          {notice && <p className="mt-4 rounded-xl bg-slate-950 p-4 text-sm text-slate-300">{notice}</p>}
        </section>

        <section className="mt-5 rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-black">처음 한 번만 해야 하는 설정</h2>
          <ol className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
            <li><b>1.</b> 텔레그램에서 <b>@BotFather</b>를 검색하고 <code>/newbot</code>으로 봇을 만듭니다.</li>
            <li><b>2.</b> 발급받은 토큰을 <code>TELEGRAM_BOT_TOKEN</code>에 넣습니다.</li>
            <li><b>3.</b> 만든 봇과 대화를 열고 <b>시작</b>을 누른 뒤 아무 메시지나 하나 보냅니다.</li>
            <li><b>4.</b> 본인 채팅 ID를 <code>TELEGRAM_CHAT_ID</code>에 넣습니다.</li>
            <li><b>5.</b> 승인 버튼 주소를 위해 <code>NEXT_PUBLIC_SITE_URL</code>에는 배포 주소를 넣습니다.</li>
          </ol>
          <div className="mt-4 rounded-xl bg-slate-950 p-4 text-sm leading-7 text-slate-400">
            필요한 환경변수<br/><code>TELEGRAM_BOT_TOKEN</code><br/><code>TELEGRAM_CHAT_ID</code><br/><code>CONTENT_APPROVAL_SECRET</code><br/><code>NEXT_PUBLIC_SITE_URL</code>
          </div>
        </section>
      </div>
    </main>
  );
}

import Link from "next/link";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function YoutubeSetupPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || `${proto}://${host}`).replace(/\/$/, "");
  const callback = `${siteUrl}/api/content/youtube/callback`;
  const configured = Boolean(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET && (process.env.YOUTUBE_TOKEN_SECRET || process.env.CONTENT_APPROVAL_SECRET));

  const items = [
    ["YOUTUBE_CLIENT_ID", Boolean(process.env.YOUTUBE_CLIENT_ID)],
    ["YOUTUBE_CLIENT_SECRET", Boolean(process.env.YOUTUBE_CLIENT_SECRET)],
    ["YOUTUBE_TOKEN_SECRET", Boolean(process.env.YOUTUBE_TOKEN_SECRET || process.env.CONTENT_APPROVAL_SECRET)],
    ["NEXT_PUBLIC_SITE_URL", Boolean(process.env.NEXT_PUBLIC_SITE_URL)],
  ] as const;

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-sm font-black text-red-400">YOUTUBE OAUTH</p><h1 className="mt-2 text-3xl font-black">유튜브 쇼츠 연결 설정</h1></div>
          <Link href="/content" className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-black">← 콘텐츠 화면</Link>
        </div>

        <section className="mt-7 rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <div className={`rounded-xl p-4 font-black ${configured ? "bg-emerald-950 text-emerald-300" : "bg-amber-950 text-amber-300"}`}>
            {configured ? "환경변수 설정 완료 · 유튜브 계정을 연결할 수 있습니다." : "아직 필요한 환경변수가 모두 입력되지 않았습니다."}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {items.map(([name, ok]) => <div key={name} className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm"><code>{name}</code><b className={ok ? "text-emerald-400" : "text-amber-400"}>{ok ? "입력됨" : "필요"}</b></div>)}
          </div>
        </section>

        <section className="mt-5 rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-black">구글에 등록할 승인된 리디렉션 URI</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Google Cloud OAuth 클라이언트의 ‘승인된 리디렉션 URI’에 아래 주소를 그대로 넣어야 합니다.</p>
          <div className="mt-4 break-all rounded-xl border border-blue-800 bg-slate-950 p-4 font-mono text-sm text-blue-300">{callback}</div>
        </section>

        <section className="mt-5 rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-black">입력해야 할 환경변수</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
            <div className="rounded-xl bg-slate-950 p-4"><b>YOUTUBE_CLIENT_ID</b><br/><span className="text-slate-500">Google Cloud에서 만든 웹 애플리케이션 OAuth 클라이언트 ID</span></div>
            <div className="rounded-xl bg-slate-950 p-4"><b>YOUTUBE_CLIENT_SECRET</b><br/><span className="text-slate-500">같은 OAuth 클라이언트의 보안 비밀</span></div>
            <div className="rounded-xl bg-slate-950 p-4"><b>YOUTUBE_TOKEN_SECRET</b><br/><span className="text-slate-500">임의의 긴 문자열. 유튜브 토큰 쿠키를 암호화하는 데 사용합니다.</span></div>
            <div className="rounded-xl bg-slate-950 p-4"><b>NEXT_PUBLIC_SITE_URL</b><br/><span className="text-slate-500">배포 후에는 https://sports-ai-alpha.vercel.app</span></div>
          </div>
          <p className="mt-4 rounded-xl bg-slate-950 p-4 text-sm leading-6 text-slate-400">로컬에서만 시험할 때는 Google Cloud에 localhost 리디렉션 URI도 별도로 등록해야 합니다. 실제 텔레그램 승인과 안정적인 계정 연결은 Vercel 배포 후 진행하는 편이 안전합니다.</p>
        </section>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Link href="/content" className="rounded-xl border border-slate-700 px-4 py-4 text-center font-black">콘텐츠 화면으로 돌아가기</Link>
          {configured ? <a href="/api/content/youtube/auth" className="rounded-xl bg-red-600 px-4 py-4 text-center font-black">유튜브 계정 연결하기</a> : <span className="rounded-xl bg-slate-800 px-4 py-4 text-center font-black text-slate-500">환경변수 입력 후 연결 가능</span>}
        </div>
      </div>
    </main>
  );
}

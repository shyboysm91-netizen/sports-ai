import Link from "next/link";

export default function InstagramSetupPage() {
  const connected = Boolean(process.env.INSTAGRAM_ACCESS_TOKEN && (process.env.INSTAGRAM_ACCOUNT_ID || process.env.INSTAGRAM_USER_ID));
  return <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-sm font-black text-pink-400">INSTAGRAM GRAPH API</p><h1 className="mt-2 text-3xl font-black">인스타그램 릴스 연결</h1></div>
        <Link href="/content" className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-black">← 콘텐츠 화면</Link>
      </div>
      <section className="mt-7 rounded-3xl border border-slate-800 bg-slate-900 p-6">
        <div className={`rounded-xl p-4 font-black ${connected ? "bg-emerald-950 text-emerald-300" : "bg-amber-950 text-amber-300"}`}>
          {connected ? "인스타그램 발행 키가 설정되어 있습니다." : "현재 인스타그램 키가 설정되지 않았습니다."}
        </div>
        <h2 className="mt-6 text-xl font-black">필요한 값 두 개</h2>
        <div className="mt-3 rounded-xl bg-slate-950 p-4 text-sm leading-8 text-slate-300">
          <code>INSTAGRAM_ACCESS_TOKEN</code> · Meta에서 발급한 장기 액세스 토큰<br/>
          <code>INSTAGRAM_ACCOUNT_ID</code> · 연결할 Instagram 프로 계정 ID
        </div>
        <ol className="mt-6 space-y-3 text-sm leading-7 text-slate-300">
          <li><b>1.</b> 인스타그램 계정을 <b>프로페셔널 계정</b>으로 전환합니다.</li>
          <li><b>2.</b> Meta 개발자 사이트에서 앱을 만들고 Instagram API를 추가합니다.</li>
          <li><b>3.</b> 해당 인스타 계정에 대한 콘텐츠 게시 권한이 포함된 장기 토큰을 발급합니다.</li>
          <li><b>4.</b> 위 두 값을 로컬의 <code>.env.local</code>과 Vercel 환경변수에 동일하게 넣습니다.</li>
          <li><b>5.</b> 개발 서버와 Vercel 배포를 다시 시작하면 연결 상태가 바뀝니다.</li>
        </ol>
        <div className="mt-6 rounded-xl border border-red-900/60 bg-red-950/20 p-4 text-sm leading-7 text-red-200">액세스 토큰은 비밀번호와 같은 비밀정보입니다. 이 화면이나 브라우저 입력칸에 저장하지 말고 서버 환경변수에만 넣어야 합니다.</div>
        <a href="https://developers.facebook.com/" target="_blank" rel="noreferrer" className="mt-5 block rounded-xl bg-gradient-to-r from-pink-600 to-violet-600 px-4 py-3 text-center font-black">Meta 개발자 사이트 열기</a>
      </section>
    </div>
  </main>;
}

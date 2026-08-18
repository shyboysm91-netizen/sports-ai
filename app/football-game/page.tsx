import Link from "next/link";

export default async function FootballGamePage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const q=await searchParams; const text=(key:string)=>typeof q[key]==="string"?q[key] as string:"";
  const home=text("home"),away=text("away"),league=text("league"),date=text("date"),time=text("time"),venue=text("venue");
  return <main className="min-h-screen bg-[#020817] px-5 py-10 text-white"><section className="mx-auto max-w-4xl"><Link href="/football" className="text-sm font-bold text-emerald-400">← 축구 일정으로</Link><div className="mt-6 rounded-3xl border border-slate-700 bg-[#0f172a] p-7"><p className="text-sm font-black text-emerald-400">{league}</p><p className="mt-2 text-sm text-slate-400">{date} {time} · {venue}</p><div className="mt-9 grid grid-cols-[1fr_auto_1fr] items-center text-center"><h1 className="text-2xl font-black">{home}</h1><span className="rounded-full border border-slate-600 px-4 py-3 font-black">VS</span><h1 className="text-2xl font-black">{away}</h1></div><div className="mt-9 rounded-2xl border border-slate-800 bg-slate-950/50 p-6"><h2 className="text-xl font-black">경기 분석 준비 중</h2><p className="mt-3 leading-7 text-slate-400">팀 최근 흐름, 홈·원정 성적, 득점력과 실점 흐름을 연결하는 축구 전용 분석 기능입니다. 야구 분석과는 완전히 분리되어 있습니다.</p></div></div></section></main>;
}

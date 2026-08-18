import Link from "next/link";
import type { Metadata } from "next";
import AnalysisClient from "./AnalysisClient";

export const metadata: Metadata = { robots: { index: false, follow: true } };

export default async function FootballGamePage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const q=await searchParams; const text=(key:string)=>typeof q[key]==="string"?q[key] as string:"";
  const home=text("home"),away=text("away"),leagueName=text("leagueName"),date=text("date"),time=text("time"),venue=text("venue");
  const query=Object.fromEntries(Object.entries(q).flatMap(([key,value])=>typeof value==="string"?[[key,value]]:[]));
  return <main className="min-h-screen bg-[#020817] px-5 py-10 text-white"><section className="mx-auto max-w-5xl"><Link href="/football" className="text-sm font-bold text-emerald-400">← 축구 일정으로</Link><div className="mt-6 rounded-3xl border border-slate-700 bg-[#0f172a] p-7"><p className="text-sm font-black text-emerald-400">{leagueName}</p><p className="mt-2 text-sm text-slate-400">{date} {time} · {venue}</p><div className="mt-9 grid grid-cols-[1fr_auto_1fr] items-center text-center"><h1 className="text-2xl font-black">{home}</h1><span className="rounded-full border border-slate-600 px-4 py-3 font-black">VS</span><h1 className="text-2xl font-black">{away}</h1></div></div><AnalysisClient query={query}/></section></main>;
}

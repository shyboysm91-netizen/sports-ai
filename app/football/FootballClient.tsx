"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type LeagueKey = "all" | "epl" | "laliga" | "bundesliga" | "seriea" | "kleague";
type Game = { id:string; league:string; leagueName:string; date:string; time:string; home:string; away:string; homeId:string; awayId:string; homeScore:string|null; awayScore:string|null; venue:string; status:string };
const leagues: { key:LeagueKey; label:string }[] = [{key:"all",label:"전체"},{key:"epl",label:"프리미어리그"},{key:"laliga",label:"라리가"},{key:"bundesliga",label:"분데스리가"},{key:"seriea",label:"세리에 A"},{key:"kleague",label:"K리그1"}];

function koreaDate(offset = 0) { const now = new Date(); now.setDate(now.getDate() + offset); return new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Seoul" }).format(now); }

export default function FootballClient() {
  const [date,setDate] = useState(koreaDate()); const [league,setLeague] = useState<LeagueKey>("all");
  const [games,setGames] = useState<Game[]>([]); const [errors,setErrors] = useState<string[]>([]); const [loading,setLoading] = useState(true);
  useEffect(()=>{ let active=true; setLoading(true); fetch(`/api/football?date=${date}${league === "all" ? "" : `&league=${league}`}`).then(r=>r.json()).then(data=>{if(active){setGames(data.games??[]);setErrors(data.errors??[])}}).catch(()=>{if(active)setErrors(["축구 일정을 불러오지 못했습니다."])}).finally(()=>{if(active)setLoading(false)}); return()=>{active=false}; },[date,league]);
  const title = useMemo(()=>leagues.find(item=>item.key===league)?.label ?? "전체",[league]);
  return <main className="min-h-screen bg-[#020817] text-white">
    <header className="border-b border-slate-800 bg-[#050b19]"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5"><Link href="/football" className="text-2xl font-black">장군 AI 축구</Link><Link href="/" className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300">야구 홈</Link></div></header>
    <section className="mx-auto max-w-6xl px-5 py-10">
      <p className="text-sm font-bold tracking-[0.22em] text-emerald-400">AI FOOTBALL SCHEDULE</p><h1 className="mt-3 text-4xl font-black">오늘의 {title} 경기 일정</h1><p className="mt-3 text-slate-400">프리미어리그·라리가·분데스리가·세리에 A·K리그1 일정을 한국시간으로 제공합니다.</p>
      <div className="mt-7 flex flex-wrap gap-2">{leagues.map(item=><button key={item.key} onClick={()=>setLeague(item.key)} className={`rounded-full px-4 py-2 text-sm font-bold ${league===item.key?"bg-emerald-500 text-slate-950":"border border-slate-700 bg-slate-900 text-slate-300"}`}>{item.label}</button>)}</div>
      <div className="mt-5 flex flex-wrap gap-2"><button onClick={()=>setDate(koreaDate(-1))} className="rounded-lg border border-slate-700 px-4 py-2">어제</button><button onClick={()=>setDate(koreaDate())} className="rounded-lg bg-slate-800 px-4 py-2">오늘</button><button onClick={()=>setDate(koreaDate(1))} className="rounded-lg border border-slate-700 px-4 py-2">내일</button><input type="date" value={date} onChange={event=>setDate(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" aria-label="경기 날짜"/><span className="self-center pl-2 text-sm text-slate-400">{date} · 한국시간</span></div>
      <div className="mt-8 flex items-end justify-between"><h2 className="text-2xl font-black">축구 경기 일정</h2><span className="text-sm text-slate-400">{loading?"불러오는 중":`${games.length}경기`}</span></div>
      {errors.length>0&&<div className="mt-4 rounded-xl border border-amber-800/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">{errors.join(" · ")}</div>}
      {!loading&&games.length===0&&<div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-10 text-center text-slate-400">선택한 날짜에 예정된 경기가 없습니다.</div>}
      <div className="mt-6 grid gap-5 md:grid-cols-2">{games.map(game=><article key={`${game.league}-${game.id}`} className="overflow-hidden rounded-2xl border border-slate-700 bg-[#0f172a]">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4"><span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-300">{game.leagueName}</span><div className="text-right"><p className="font-black">{game.time}</p><p className="text-xs text-slate-500">{game.venue}</p></div></div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 py-7 text-center"><div><p className="text-xs text-slate-500">홈팀</p><h3 className="mt-2 text-xl font-black">{game.home}</h3></div><div><p className="text-xs font-bold text-emerald-300">{game.status}</p><div className="mt-2 rounded-full border border-slate-700 px-3 py-2 font-black">{game.homeScore!=null?`${game.homeScore} : ${game.awayScore}`:"VS"}</div></div><div><p className="text-xs text-slate-500">원정팀</p><h3 className="mt-2 text-xl font-black">{game.away}</h3></div></div>
        <Link href={`/football-game?league=${game.league}&leagueName=${encodeURIComponent(game.leagueName)}&gameId=${encodeURIComponent(game.id)}&date=${date}&home=${encodeURIComponent(game.home)}&away=${encodeURIComponent(game.away)}&homeId=${encodeURIComponent(game.homeId)}&awayId=${encodeURIComponent(game.awayId)}&time=${encodeURIComponent(game.time)}&venue=${encodeURIComponent(game.venue)}`} className="m-5 mt-0 block rounded-xl bg-emerald-500 py-3 text-center font-black text-slate-950">경기 분석 보기</Link>
      </article>)}</div>
    </section>
  </main>;
}

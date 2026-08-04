import type { Metadata } from "next";
import { redirect } from "next/navigation";
import KboGameClient from "../../../../../game/GameClient";
import MlbGameClient from "../../../../../mlb-game/GameClient";
import NpbGameClient from "../../../../../npb-game/GameClient";

const BASE_URL = "https://장군분석.kr";
type Params = Promise<{ league: string; date: string; matchup: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] ?? "" : v ?? "";
const decode = (v: string) => { try { return decodeURIComponent(v); } catch { return v; } };
function parse(matchup: string) { const v=decode(matchup); const i=v.indexOf("-vs-"); return i<0?{away:"Away Team",home:"Home Team"}:{away:v.slice(0,i),home:v.slice(i+4)}; }
function league(v:string){ const x=v.toLowerCase(); return x==="mlb"||x==="npb"?x:"kbo"; }

export async function generateMetadata({params,searchParams}:{params:Params;searchParams:SearchParams}):Promise<Metadata>{
  const p=await params,q=await searchParams,l=league(p.league),m=parse(p.matchup);
  const away=first(q.away)||m.away, home=first(q.home)||m.home, date=first(q.date)||p.date;
  const canonical=`${BASE_URL}/en/analysis/${l}/${encodeURIComponent(p.date)}/${p.matchup}`;
  const ko=canonical.replace("/en/analysis/","/analysis/");
  const title=`${away} vs ${home} ${l.toUpperCase()} Prediction & AI Analysis`;
  const description=`${date} ${away} vs ${home}: starting pitchers, recent form, head-to-head stats, team strength, win probability and projected score.`;
  return { title, description, alternates:{canonical,languages:{"en-US":canonical,"ko-KR":ko}}, openGraph:{title,description,url:canonical,locale:"en_US",type:"article"}, twitter:{card:"summary_large_image",title,description} };
}

export default async function EnglishAnalysis({params,searchParams}:{params:Params;searchParams:SearchParams}){
  const p=await params,q=await searchParams,l=league(p.league),m=parse(p.matchup);
  const away=first(q.away)||m.away,home=first(q.home)||m.home,date=first(q.date)||p.date;
  if(!first(q.away)||!first(q.home)||!first(q.date)){
    const next=new URLSearchParams(); for(const [k,r] of Object.entries(q)){const v=first(r);if(v)next.set(k,v)}
    next.set("league",l.toUpperCase());next.set("date",date);next.set("away",away);next.set("home",home);
    redirect(`/en/analysis/${l}/${encodeURIComponent(p.date)}/${p.matchup}?${next.toString()}`);
  }
  return l==="mlb"?<MlbGameClient/>:l==="npb"?<NpbGameClient/>:<KboGameClient/>;
}

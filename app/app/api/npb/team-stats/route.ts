import { NextResponse } from "next/server";
import { findTeam, num, playerNameKo, tableRows } from "../_shared";

type Batter = { name:string; originalName:string; games:number; plateAppearances:number; atBats:number; runs:number; hits:number; doubles:number; triples:number; homeRuns:number; totalBases:number; rbi:number; steals:number; walks:number; hitByPitch:number; strikeouts:number };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request:Request){
  const q=new URL(request.url).searchParams;
  const teamName=q.get("team")??"";
  const season=/^\d{4}$/.test(q.get("season")??"")?q.get("season")!:String(new Date().getFullYear());
  const team=findTeam(teamName);
  if(!team)return NextResponse.json({success:false,message:"NPB 팀을 찾지 못했습니다."},{status:400,headers:{"Cache-Control":"no-store"}});
  try{
    const response=await fetch(`https://npb.jp/bis/eng/${season}/stats/idb1_${team.code}.html`,{headers:{"User-Agent":"Mozilla/5.0",Accept:"text/html"},cache:"no-store"});
    if(!response.ok)throw new Error(`NPB 타격 기록 요청 실패: ${response.status}`);
    const players:Batter[]=[];
    for(const row of tableRows(await response.text())){
      const nameIndex=row.findIndex((cell,i)=>i<4&&/,/.test(cell)&&/[A-Za-z]/.test(cell));
      if(nameIndex<0)continue;
      const originalName=row[nameIndex].replace(/^[*+]/,"").trim();
      const s=row.slice(nameIndex+1);
      if(s.length<23||!/^\d+$/.test(s[0]??""))continue;
      players.push({name:playerNameKo(originalName),originalName,games:num(s[0]),plateAppearances:num(s[1]),atBats:num(s[2]),runs:num(s[3]),hits:num(s[4]),doubles:num(s[5]),triples:num(s[6]),homeRuns:num(s[7]),totalBases:num(s[8]),rbi:num(s[9]),steals:num(s[10]),walks:num(s[14]),hitByPitch:num(s[16]),strikeouts:num(s[17])});
    }
    const totals=players.reduce((a,p)=>({games:Math.max(a.games,p.games),plateAppearances:a.plateAppearances+p.plateAppearances,atBats:a.atBats+p.atBats,runs:a.runs+p.runs,hits:a.hits+p.hits,doubles:a.doubles+p.doubles,triples:a.triples+p.triples,homeRuns:a.homeRuns+p.homeRuns,totalBases:a.totalBases+p.totalBases,rbi:a.rbi+p.rbi,steals:a.steals+p.steals,walks:a.walks+p.walks,hitByPitch:a.hitByPitch+p.hitByPitch,strikeouts:a.strikeouts+p.strikeouts}),{games:0,plateAppearances:0,atBats:0,runs:0,hits:0,doubles:0,triples:0,homeRuns:0,totalBases:0,rbi:0,steals:0,walks:0,hitByPitch:0,strikeouts:0});
    const avg=totals.atBats?totals.hits/totals.atBats:0,slg=totals.atBats?totals.totalBases/totals.atBats:0,obpDen=totals.atBats+totals.walks+totals.hitByPitch,obp=obpDen?(totals.hits+totals.walks+totals.hitByPitch)/obpDen:0;
    return NextResponse.json({success:true,version:"NPB-v3",source:"NPB 공식 팀별 선수 타격 기록",season,team:team.ko,stats:{...totals,average:avg,onBasePercentage:obp,sluggingPercentage:slg,ops:obp+slg},leaders:{average:[...players].filter(p=>p.atBats>=30).sort((a,b)=>b.hits/b.atBats-a.hits/a.atBats).slice(0,3).map(p=>({name:p.name,value:p.hits/p.atBats})),homeRuns:[...players].sort((a,b)=>b.homeRuns-a.homeRuns).slice(0,3).map(p=>({name:p.name,value:p.homeRuns})),rbi:[...players].sort((a,b)=>b.rbi-a.rbi).slice(0,3).map(p=>({name:p.name,value:p.rbi}))}}, {headers:{"Cache-Control":"no-store, no-cache, must-revalidate"}});
  }catch(error){return NextResponse.json({success:false,message:error instanceof Error?error.message:"NPB 타격 기록 오류"},{status:500,headers:{"Cache-Control":"no-store"}})}
}

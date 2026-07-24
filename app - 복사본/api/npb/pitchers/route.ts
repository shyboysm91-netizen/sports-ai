import { NextResponse } from "next/server";
import { findTeam, inningsToOuts, num, outsToInnings, playerNameKo, tableRows } from "../_shared";
type Pitcher={name:string;originalName:string;games:number;wins:number;losses:number;saves:number;holds:number;inningsOuts:number;hits:number;homeRuns:number;walks:number;hitByPitch:number;strikeouts:number;runs:number;earnedRuns:number;era:number};
export const revalidate=21600;
export async function GET(request:Request){
 const q=new URL(request.url).searchParams,teamName=q.get("team")??"",season=/^\d{4}$/.test(q.get("season")??"")?q.get("season")!:String(new Date().getFullYear()),team=findTeam(teamName);
 if(!team)return NextResponse.json({success:false,message:"NPB 팀을 찾지 못했습니다."},{status:400,headers:{"Cache-Control":"no-store"}});
 try{
  const response=await fetch(`https://npb.jp/bis/eng/${season}/stats/idp1_${team.code}.html`,{headers:{"User-Agent":"Mozilla/5.0",Accept:"text/html"},next:{revalidate:21600}}); if(!response.ok)throw new Error(`NPB 투수 기록 요청 실패: ${response.status}`);
  const players:Pitcher[]=[];
  for(const row of tableRows(await response.text())){
   const nameIndex=row.findIndex((cell,i)=>i<4&&/,/.test(cell)&&/[A-Za-z]/.test(cell)); if(nameIndex<0)continue;
   const originalName=row[nameIndex].replace(/^[*+]/,"").trim(),s=row.slice(nameIndex+1); if(s.length<23||!/^\d+$/.test(s[0]??""))continue;
   players.push({name:playerNameKo(originalName),originalName,games:num(s[0]),wins:num(s[1]),losses:num(s[2]),saves:num(s[3]),holds:num(s[4]),inningsOuts:inningsToOuts(s[11]),hits:num(s[12]),homeRuns:num(s[13]),walks:num(s[14]),hitByPitch:num(s[16]),strikeouts:num(s[17]),runs:num(s[20]),earnedRuns:num(s[21]),era:num(s[22])});
  }
  const derived=players.map(p=>{const innings=p.inningsOuts/3;return {...p,innings:outsToInnings(p.inningsOuts),whip:innings?(p.hits+p.walks)/innings:0,kPer9:innings?p.strikeouts*9/innings:0,bbPer9:innings?p.walks*9/innings:0}});
  const rotation=[...derived].filter(p=>p.inningsOuts>=30).sort((a,b)=>b.inningsOuts-a.inningsOuts).slice(0,6),bullpen=[...derived].filter(p=>p.games>=8&&p.inningsOuts<Math.max(90,p.games*9)).sort((a,b)=>b.games-a.games).slice(0,8);
  const outs=players.reduce((s,p)=>s+p.inningsOuts,0),earned=players.reduce((s,p)=>s+p.earnedRuns,0),hits=players.reduce((s,p)=>s+p.hits,0),walks=players.reduce((s,p)=>s+p.walks,0);
  return NextResponse.json({success:true,version:"NPB-v3",source:"NPB 공식 팀별 선수 투수 기록",season,team:team.ko,teamPitching:{innings:outsToInnings(outs),era:outs?earned*27/outs:0,whip:outs?(hits+walks)*3/outs:0},rotation,bullpen},{headers:{"Cache-Control":"public, s-maxage=21600, stale-while-revalidate=86400"}});
 }catch(error){return NextResponse.json({success:false,message:error instanceof Error?error.message:"NPB 투수 기록 오류"},{status:500,headers:{"Cache-Control":"no-store"}})}
}

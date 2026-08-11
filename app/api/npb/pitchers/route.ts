import { NextResponse } from "next/server";
import { cleanHtml, findTeam, inningsToOuts, num, outsToInnings, playerNameKo, tableRows } from "../_shared";
type Pitcher={name:string;originalName:string;playerCode:string;games:number;wins:number;losses:number;saves:number;holds:number;inningsOuts:number;hits:number;homeRuns:number;walks:number;hitByPitch:number;strikeouts:number;runs:number;earnedRuns:number;era:number};
export const revalidate=21600;
export async function GET(request:Request){
 const q=new URL(request.url).searchParams,teamName=q.get("team")??"",season=/^\d{4}$/.test(q.get("season")??"")?q.get("season")!:String(new Date().getFullYear()),team=findTeam(teamName);
 if(!team)return NextResponse.json({success:false,message:"NPB 팀을 찾지 못했습니다."},{status:400,headers:{"Cache-Control":"no-store"}});
 try{
  const [response,rosterResponse]=await Promise.all([
   fetch(`https://npb.jp/bis/eng/${season}/stats/idp1_${team.code}.html`,{headers:{"User-Agent":"Mozilla/5.0",Accept:"text/html"},next:{revalidate:21600}}),
   fetch(`https://npb.jp/bis/eng/teams/rst_${team.code}.html`,{headers:{"User-Agent":"Mozilla/5.0",Accept:"text/html"},next:{revalidate:21600}}),
  ]); if(!response.ok)throw new Error(`NPB 투수 기록 요청 실패: ${response.status}`);
  const players:Pitcher[]=[];
  const html = await response.text();
  const rosterHtml=rosterResponse.ok?await rosterResponse.text():"";
  const rosterCodes=new Map<string,string>();
  for(const match of rosterHtml.matchAll(/<a\b[^>]*href=["'][^"']*\/players\/(\d+)\.html[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)){
   const label=cleanHtml(match[2]).toLowerCase().replace(/[^a-z0-9]/g,"");
   if(label)rosterCodes.set(label,match[1]);
  }
  const rawRows = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  for(const rawRow of rawRows){
   const row = (rawRow.match(/<t[dh]\b[^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []).map((cell) => cell.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&#39;/gi, "'").replace(/&quot;/gi, '"').replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
   // NPB 페이지는 시즌/언어에 따라 선수 링크 경로가 달라진다.
   // 경로 전체를 고정하지 않고 행 안의 선수 프로필 HTML 파일 번호를 읽는다.
   let playerCode = rawRow.match(/href=["'][^"']*?(?:players\/)?(\d{6,})\.html(?:[?#][^"']*)?["']/i)?.[1]
     || rawRow.match(/(?:players\/|\/)(\d{6,})\.html/i)?.[1]
     || "";
   const nameIndex=row.findIndex((cell,i)=>i<4&&/,/.test(cell)&&/[A-Za-z]/.test(cell)); if(nameIndex<0)continue;
   const originalName=row[nameIndex].replace(/^[*+]/,"").trim();
   playerCode ||= rosterCodes.get(originalName.toLowerCase().replace(/[^a-z0-9]/g,"")) || "";
   const s=row.slice(nameIndex+1).map((v)=>v.trim()).filter((v)=>v!=="");
   // 팀별 투수 표는 선수/팀에 따라 보조 열 수가 달라질 수 있다.
   // 23개 고정 조건을 없애고 공식 표의 끝쪽 ERA·실점·자책점과 앞쪽 기본 기록을 기준으로 읽는다.
   if(s.length<18||!/^\d+$/.test(s[0]??""))continue;
   const eraIndex=s.length-1;
   const earnedIndex=s.length-2;
   const runsIndex=s.length-3;
   const strikeoutIndex=Math.max(0,eraIndex-5);
   const inningsIndex=Math.max(0,eraIndex-11);
   const hitsIndex=inningsIndex+1, homeRunsIndex=inningsIndex+2, walksIndex=inningsIndex+3, hitByPitchIndex=inningsIndex+5;
   players.push({name:playerNameKo(originalName),originalName,playerCode,games:num(s[0]),wins:num(s[1]),losses:num(s[2]),saves:num(s[3]),holds:num(s[4]),inningsOuts:inningsToOuts(s[inningsIndex]),hits:num(s[hitsIndex]),homeRuns:num(s[homeRunsIndex]),walks:num(s[walksIndex]),hitByPitch:num(s[hitByPitchIndex]),strikeouts:num(s[strikeoutIndex]),runs:num(s[runsIndex]),earnedRuns:num(s[earnedIndex]),era:num(s[eraIndex])});
  }
  const derived=players.map(p=>{const innings=p.inningsOuts/3;return {...p,innings:outsToInnings(p.inningsOuts),whip:innings?(p.hits+p.walks)/innings:0,kPer9:innings?p.strikeouts*9/innings:0,bbPer9:innings?p.walks*9/innings:0}});
  const rotation=[...derived].filter(p=>p.inningsOuts>=3).sort((a,b)=>b.inningsOuts-a.inningsOuts).slice(0,18),bullpen=[...derived].filter(p=>p.games>=8&&p.inningsOuts<Math.max(90,p.games*9)).sort((a,b)=>b.games-a.games).slice(0,8);
  const outs=players.reduce((s,p)=>s+p.inningsOuts,0),earned=players.reduce((s,p)=>s+p.earnedRuns,0),hits=players.reduce((s,p)=>s+p.hits,0),walks=players.reduce((s,p)=>s+p.walks,0);
  return NextResponse.json({success:true,version:"NPB-v5-playercode",source:"NPB 공식 팀별 선수 투수 기록",season,team:team.ko,teamPitching:{innings:outsToInnings(outs),era:outs?earned*27/outs:0,whip:outs?(hits+walks)*3/outs:0},players:derived,rotation,bullpen},{headers:{"Cache-Control":"public, s-maxage=21600, stale-while-revalidate=86400"}});
 }catch(error){return NextResponse.json({success:false,message:error instanceof Error?error.message:"NPB 투수 기록 오류"},{status:500,headers:{"Cache-Control":"no-store"}})}
}

import { NextResponse } from "next/server";

type Standing={team:string;rank:number;wins:number;losses:number;draws:number;winningPercentage:number;home:string;away:string};
type Batting={average:number;onBasePercentage:number;sluggingPercentage:number;ops:number;homeRuns:number;walks:number;strikeouts:number;runs:number;games:number};
type Pitching={era:number;whip:number};
function clamp(n:number,min:number,max:number){return Math.max(min,Math.min(max,n))}
function splitRate(v:string|undefined){const m=(v??"").match(/(\d+)-(\d+)/);if(!m)return .5;const w=Number(m[1]),l=Number(m[2]);return w+l?w/(w+l):.5}
async function json(origin:string,path:string){const r=await fetch(`${origin}${path}`,{cache:"no-store"});return r.json()}
export async function GET(req:Request){
 try{const u=new URL(req.url),q=u.searchParams,away=q.get("away")||"원정팀",home=q.get("home")||"홈팀",season=(q.get("date")||String(new Date().getFullYear())).slice(0,4);
  const [standings,awayBat,homeBat,awayPit,homePit]=await Promise.all([
   json(u.origin,"/api/npb/standings"),json(u.origin,`/api/npb/team-stats?team=${encodeURIComponent(away)}&season=${season}`),json(u.origin,`/api/npb/team-stats?team=${encodeURIComponent(home)}&season=${season}`),json(u.origin,`/api/npb/pitchers?team=${encodeURIComponent(away)}&season=${season}`),json(u.origin,`/api/npb/pitchers?team=${encodeURIComponent(home)}&season=${season}`)
  ]);
  const a:Standing|undefined=standings.standings?.find((x:Standing)=>x.team===away),h:Standing|undefined=standings.standings?.find((x:Standing)=>x.team===home);const ab:Batting|undefined=awayBat.stats,hb:Batting|undefined=homeBat.stats,ap:Pitching|undefined=awayPit.teamPitching,hp:Pitching|undefined=homePit.teamPitching;
  const seasonEdge=((h?.winningPercentage??.5)-(a?.winningPercentage??.5))*34;const battingEdge=((hb?.ops??.65)-(ab?.ops??.65))*42;const pitchingEdge=((ap?.era??3.5)-(hp?.era??3.5))*2.8;const homeForm=(splitRate(h?.home)-splitRate(a?.away))*13;const homeAdv=3;const homeProb=Math.round(clamp(50+seasonEdge+battingEdge+pitchingEdge+homeForm+homeAdv,25,75));const pick=homeProb>=50?home:away;const confidence=Math.round(clamp(54+Math.abs(homeProb-50)*1.25,54,88));
  const scores={season:Math.round(seasonEdge*10)/10,batting:Math.round(battingEdge*10)/10,pitching:Math.round(pitchingEdge*10)/10,homeAway:Math.round((homeForm+homeAdv)*10)/10};
  const reasons=[`${pick}이 시즌 승률·타선 OPS·팀 투수력 종합 점수에서 우세합니다.`,hb&&ab?`팀 OPS는 ${away} ${ab.ops.toFixed(3)}, ${home} ${hb.ops.toFixed(3)}입니다.`:"팀 타격 기록 일부를 불러오지 못했습니다.",hp&&ap?`팀 평균자책점은 ${away} ${ap.era.toFixed(2)}, ${home} ${hp.era.toFixed(2)}입니다.`:"팀 투수 기록 일부를 불러오지 못했습니다.","공식 선발 발표 전에는 팀 전체 투수 지표와 로테이션 후보를 반영한 예비 분석입니다."];
  return NextResponse.json({success:true,awayStanding:a||null,homeStanding:h||null,awayBatting:ab||null,homeBatting:hb||null,awayPitching:ap||null,homePitching:hp||null,awayRotation:awayPit.rotation||[],homeRotation:homePit.rotation||[],awayBullpen:awayPit.bullpen||[],homeBullpen:homePit.bullpen||[],probability:{away:100-homeProb,home:homeProb},pick,confidence,scores,reasons});
 }catch(e){return NextResponse.json({success:false,message:e instanceof Error?e.message:"분석 오류"},{status:500})}
}

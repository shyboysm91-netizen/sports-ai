import { NextResponse } from "next/server";

type Standing={team:string;rank:number;wins:number;losses:number;draws:number;winningPercentage:number;home:string;away:string};
type Batting={average:number;onBasePercentage:number;sluggingPercentage:number;ops:number;homeRuns:number;walks:number;strikeouts:number;runs:number;games:number};
type Pitching={era:number;whip:number};

function clamp(n:number,min:number,max:number){return Math.max(min,Math.min(max,n))}
function splitRate(v:string|undefined){const m=(v??"").match(/(\d+)-(\d+)/);if(!m)return .5;const w=Number(m[1]),l=Number(m[2]);return w+l?w/(w+l):.5}
async function json(origin:string,path:string){
  const r=await fetch(`${origin}${path}`,{next:{revalidate:300}});
  const data=await r.json();
  return data;
}
function sameName(a:string,b:string){
  const clean=(v:string)=>v.toLowerCase().replace(/[^a-z0-9가-힣]/g,"");
  return clean(a)===clean(b) || clean(a).includes(clean(b)) || clean(b).includes(clean(a));
}

function f(value:number|undefined,digits=2){
  return typeof value==="number"&&Number.isFinite(value)?value.toFixed(digits):"-";
}
function shortTeam(name:string){
  return name
    .replace("도쿄 야쿠르트 스왈로스","야쿠르트")
    .replace("주니치 드래건스","주니치")
    .replace("요미우리 자이언츠","요미우리")
    .replace("한신 타이거스","한신")
    .replace("요코하마 DeNA 베이스타스","요코하마")
    .replace("히로시마 도요 카프","히로시마")
    .replace("후쿠오카 소프트뱅크 호크스","소프트뱅크")
    .replace("홋카이도 닛폰햄 파이터스","닛폰햄")
    .replace("오릭스 버팔로스","오릭스")
    .replace("도호쿠 라쿠텐 골든이글스","라쿠텐")
    .replace("사이타마 세이부 라이온스","세이부")
    .replace("지바 롯데 마린스","치바롯데");
}
function edgeTeam(score:number,away:string,home:string){
  if(Math.abs(score)<.3)return "양 팀";
  return score>0?shortTeam(home):shortTeam(away);
}
function starterSentence(team:string,p:any){
  if(!p)return `${shortTeam(team)} 선발 정보가 아직 확정되지 않아 선발 매치업 평가는 제한적입니다.`;
  const era=Number(p.era),whip=Number(p.whip),k9=Number(p.kPer9),bb9=Number(p.bbPer9);
  const stability=era<=2.5&&whip<=1.1
    ?"리그 상위권 수준의 실점 억제력과 주자 관리 능력을 보여주고 있습니다"
    :era<=3.5&&whip<=1.3
      ?"선발로서 안정적인 경기 운영이 가능한 지표를 기록하고 있습니다"
      :"출루 허용과 실점 변동성이 있어 경기 초반 제구가 중요합니다";
  const command=Number.isFinite(bb9)&&bb9<=2
    ?"볼넷 억제력이 좋아 불필요한 주자 허용이 적은 유형입니다"
    :Number.isFinite(bb9)&&bb9>=3.5
      ?"볼넷 허용이 다소 많아 투구 수 관리가 핵심 변수입니다"
      :"제구 지표는 평균 범위로 판단됩니다";
  const power=Number.isFinite(k9)&&k9>=8
    ?"삼진 생산력도 충분해 위기 상황에서 스스로 아웃카운트를 만들 수 있습니다"
    :"탈삼진보다는 맞혀 잡는 운영 비중이 높은 편입니다";
  return `${shortTeam(team)} 선발 ${p.name}는 시즌 ERA ${f(era)}, WHIP ${f(whip)}로 ${stability}. ${command}. ${power}.`;
}
function battingSentence(away:string,home:string,ab:any,hb:any,score:number){
  if(!ab||!hb)return "양 팀 타격 자료 일부가 비어 있어 타선 비교의 신뢰도는 제한적입니다.";
  const leader=edgeTeam(score,away,home);
  const close=Math.abs(score)<.5;
  return close
    ? `양 팀 OPS가 ${shortTeam(away)} ${f(ab.ops,3)}, ${shortTeam(home)} ${f(hb.ops,3)}로 큰 차이가 없습니다. 장타력보다는 출루 이후의 주루와 득점권 집중력이 실제 승부를 가를 가능성이 높습니다.`
    : `${leader} 타선이 시즌 OPS와 장타 생산성에서 상대적으로 앞서 있습니다. ${shortTeam(away)} OPS ${f(ab.ops,3)}, ${shortTeam(home)} OPS ${f(hb.ops,3)}이며, 공격 지표 격차가 유지된다면 중반 이후 추가 득점 기대값도 ${leader} 쪽이 높습니다.`;
}
function bullpenSentence(away:string,home:string,ap:any,hp:any,score:number){
  if(!ap||!hp)return "불펜 세부 등판 이력이 충분하지 않아 팀 평균자책점 중심으로만 평가했습니다.";
  const leader=edgeTeam(score,away,home);
  return `${shortTeam(away)} 팀 ERA ${f(ap.era)}, ${shortTeam(home)} 팀 ERA ${f(hp.era)}입니다. 전체 투수 지표상 ${leader}가 근소하게 앞서지만, 실제 후반 승부는 최근 3일간 필승조 소모 여부와 선발의 소화 이닝에 따라 달라질 수 있습니다.`;
}
function formSentence(away:string,home:string,ar:any,hr:any,score:number){
  const aw=ar?.summary?.wins??0,al=ar?.summary?.losses??0;
  const hw=hr?.summary?.wins??0,hl=hr?.summary?.losses??0;
  const leader=edgeTeam(score,away,home);
  return `최근 10경기 성적은 ${shortTeam(away)} ${aw}승 ${al}패, ${shortTeam(home)} ${hw}승 ${hl}패입니다. 단기 흐름은 ${leader} 쪽에 유리하게 반영됐지만, 최근 성적은 상대 일정 강도에 따라 변동성이 크므로 시즌 전력보다 낮은 비중으로 평가했습니다.`;
}
function matchupSentence(away:string,home:string,h2h:any,score:number){
  const wins=h2h?.summary?.wins??0,losses=h2h?.summary?.losses??0;
  if(!h2h)return "최근 맞대결 표본이 충분하지 않아 상대전적은 중립값으로 처리했습니다.";
  if(Math.abs(score)<.3)return `최근 맞대결은 ${shortTeam(home)} 기준 ${wins}승 ${losses}패로 뚜렷한 우열이 없습니다. 특정 팀이 일방적으로 강했다고 보기 어려워 선발과 당일 타선 컨디션이 더 중요합니다.`;
  return `최근 맞대결은 ${shortTeam(home)} 기준 ${wins}승 ${losses}패입니다. 표본은 제한적이지만 ${edgeTeam(score,away,home)}가 상대 매치업에서 조금 더 나은 결과를 냈습니다.`;
}

function starterCard(rotation:any[], requested:string){
  const pitcher=(requested?rotation.find((p:any)=>sameName(p.name??"",requested)||sameName(p.originalName??"",requested)):null)||rotation[0]||null;
  if(!pitcher) return null;
  return {
    ...pitcher,
    requestedName:requested||"",
    status:requested?"공식 선발 연결":"로테이션 후보",
  };
}

export const revalidate=300;

export async function GET(req:Request){
 try{
  const u=new URL(req.url),q=u.searchParams;
  const away=q.get("away")||"원정팀",home=q.get("home")||"홈팀";
  const awayStarter=q.get("awayStarter")||"",homeStarter=q.get("homeStarter")||"",stadium=q.get("stadium")||"";
  const date=q.get("date")||String(new Date().getFullYear());
  const season=date.slice(0,4);

  const [standings,awayBat,homeBat,awayPit,homePit,awayRecent,homeRecent,h2h]=await Promise.all([
   json(u.origin,"/api/npb/standings"),
   json(u.origin,`/api/npb/team-stats?team=${encodeURIComponent(away)}&season=${season}`),
   json(u.origin,`/api/npb/team-stats?team=${encodeURIComponent(home)}&season=${season}`),
   json(u.origin,`/api/npb/pitchers?team=${encodeURIComponent(away)}&season=${season}`),
   json(u.origin,`/api/npb/pitchers?team=${encodeURIComponent(home)}&season=${season}`),
   json(u.origin,`/api/npb/recent-games-v2?team=${encodeURIComponent(away)}&date=${encodeURIComponent(date)}&limit=10`),
   json(u.origin,`/api/npb/recent-games-v2?team=${encodeURIComponent(home)}&date=${encodeURIComponent(date)}&limit=10`),
   json(u.origin,`/api/npb/recent-games-v2?team=${encodeURIComponent(home)}&opponent=${encodeURIComponent(away)}&date=${encodeURIComponent(date)}&limit=10`),
  ]);

  const awayBase=starterCard(awayPit.rotation||[],awayStarter);
  const homeBase=starterCard(homePit.rotation||[],homeStarter);
  const [awayDetail,homeDetail]=await Promise.all([
    awayBase?json(u.origin,`/api/npb/pitcher-detail?team=${encodeURIComponent(away)}&opponent=${encodeURIComponent(home)}&date=${encodeURIComponent(date)}&stadium=${encodeURIComponent(stadium)}&name=${encodeURIComponent(awayBase.name||"")}&originalName=${encodeURIComponent(awayBase.originalName||awayBase.name||"")}`):Promise.resolve(null),
    homeBase?json(u.origin,`/api/npb/pitcher-detail?team=${encodeURIComponent(home)}&opponent=${encodeURIComponent(away)}&date=${encodeURIComponent(date)}&stadium=${encodeURIComponent(stadium)}&name=${encodeURIComponent(homeBase.name||"")}&originalName=${encodeURIComponent(homeBase.originalName||homeBase.name||"")}`):Promise.resolve(null),
  ]);

  const a:Standing|undefined=standings.standings?.find((x:Standing)=>x.team===away);
  const h:Standing|undefined=standings.standings?.find((x:Standing)=>x.team===home);
  const ab:Batting|undefined=awayBat.stats,hb:Batting|undefined=homeBat.stats;
  const ap:Pitching|undefined=awayPit.teamPitching,hp:Pitching|undefined=homePit.teamPitching;

  const seasonEdge=((h?.winningPercentage??.5)-(a?.winningPercentage??.5))*34;
  const battingEdge=((hb?.ops??.65)-(ab?.ops??.65))*42;
  const pitchingEdge=((ap?.era??3.5)-(hp?.era??3.5))*2.8;
  const homeForm=(splitRate(h?.home)-splitRate(a?.away))*13;
  const recentEdge=((homeRecent?.summary?.wins??0)-(awayRecent?.summary?.wins??0))*0.6;
  const h2hEdge=((h2h?.summary?.wins??0)-(h2h?.summary?.losses??0))*0.45;
  const homeAdv=3;

  const homeProb=Math.round(clamp(50+seasonEdge+battingEdge+pitchingEdge+homeForm+recentEdge+h2hEdge+homeAdv,25,75));
  const pick=homeProb>=50?home:away;
  const confidence=Math.round(clamp(54+Math.abs(homeProb-50)*1.25,54,88));
  const scores={
    season:Math.round(seasonEdge*10)/10,
    batting:Math.round(battingEdge*10)/10,
    pitching:Math.round(pitchingEdge*10)/10,
    homeAway:Math.round((homeForm+homeAdv)*10)/10,
    recent:Math.round(recentEdge*10)/10,
    headToHead:Math.round(h2hEdge*10)/10,
  };

  const awayStarterFull=awayBase?{...awayBase,...(awayDetail?.success?awayDetail:{})}:null;
  const homeStarterFull=homeBase?{...homeBase,...(homeDetail?.success?homeDetail:{})}:null;
  const starterEdge=(()=>{
    const ae=Number(awayStarterFull?.era),he=Number(homeStarterFull?.era);
    const aw=Number(awayStarterFull?.whip),hw=Number(homeStarterFull?.whip);
    if(!Number.isFinite(ae)||!Number.isFinite(he))return 0;
    return ((ae-he)*2.2)+((aw-hw)*4);
  })();
  const overallGap=Math.abs(homeProb-50);
  const scenario=homeProb>=50
    ? `${shortTeam(home)}는 홈 이점과 종합 지표 우위를 활용해 중반 이후 주도권을 잡는 시나리오가 가장 유력합니다. ${shortTeam(away)}가 승부를 뒤집으려면 선발이 최소 6이닝을 안정적으로 막고 초반 득점 지원을 받아야 합니다.`
    : `${shortTeam(away)}는 선발 또는 시즌 전력 우위를 바탕으로 경기 초반 리드를 확보하는 시나리오가 가장 유력합니다. ${shortTeam(home)}는 홈 경기 이점과 불펜 운영으로 후반 접전 구도를 만들어야 합니다.`;

  const expertAnalysis={
    starterMatchup:{
      title:"선발투수 매치업",
      text:`${starterSentence(away,awayStarterFull)} ${starterSentence(home,homeStarterFull)} 종합 선발 매치업은 ${edgeTeam(starterEdge,away,home)} 쪽이 ${Math.abs(starterEdge)>=2?"뚜렷하게":"근소하게"} 우세한 것으로 평가됩니다.`,
    },
    batting:{
      title:"타선 생산성",
      text:battingSentence(away,home,ab,hb,scores.batting),
    },
    bullpen:{
      title:"불펜·후반 운영",
      text:bullpenSentence(away,home,ap,hp,scores.pitching),
    },
    homeAway:{
      title:"홈·원정 변수",
      text:`${shortTeam(home)}의 홈 승률과 ${shortTeam(away)}의 원정 승률을 비교하면 ${edgeTeam(scores.homeAway,away,home)} 쪽에 유리한 환경입니다. 홈구장 적응도와 마지막 공격권은 접전에서 의미가 있지만, 선발 격차가 큰 경기에서는 영향력이 제한될 수 있습니다.`,
    },
    recentForm:{
      title:"최근 경기 흐름",
      text:formSentence(away,home,awayRecent,homeRecent,scores.recent),
    },
    matchup:{
      title:"상대전적 해석",
      text:matchupSentence(away,home,h2h,scores.headToHead),
    },
    keyPoint:{
      title:"승부 핵심 포인트",
      text:scenario,
    },
    finalOutlook:{
      title:"AI 최종 전망",
      text:`종합 모델은 ${shortTeam(pick)} 승리 확률을 ${pick===home?homeProb:100-homeProb}%로 평가합니다. 양 팀 확률 차이는 ${Math.round(overallGap*2)}%포인트이며, 현재 신뢰도는 ${confidence}점입니다. ${overallGap<4?"전력 차이가 크지 않아 단일 변수에 따라 결과가 바뀔 수 있는 접전 구간입니다.":overallGap<9?"한쪽이 우세하지만 선발 조기 강판이나 득점권 변수가 결과를 뒤집을 수 있습니다.":"여러 핵심 지표가 같은 방향을 가리키는 비교적 선명한 매치업입니다."}`,
    },
    cautions:[
      "공식 선발 변경 또는 경기 당일 라인업 제외 선수는 반영 시점에 따라 누락될 수 있습니다.",
      "최근 불펜 연투와 당일 컨디션은 경기 직전 최종 확인이 필요합니다.",
      "예측 확률은 경기 결과를 보장하지 않으며 데이터 기반 상대 비교값입니다.",
    ],
  };

  const reasons=[
    expertAnalysis.starterMatchup.text,
    expertAnalysis.batting.text,
    expertAnalysis.keyPoint.text,
  ];

  return NextResponse.json({
    success:true,
    awayStanding:a||null,homeStanding:h||null,
    awayBatting:ab||null,homeBatting:hb||null,
    awayPitching:ap||null,homePitching:hp||null,
    awayRotation:awayPit.rotation||[],homeRotation:homePit.rotation||[],
    awayBullpen:awayPit.bullpen||[],homeBullpen:homePit.bullpen||[],
    awayStarterDetail:awayStarterFull,
    homeStarterDetail:homeStarterFull,
    awayRecent:awayRecent?.success?awayRecent:null,
    homeRecent:homeRecent?.success?homeRecent:null,
    headToHead:h2h?.success?h2h:null,
    probability:{away:100-homeProb,home:homeProb},
    pick,confidence,scores,reasons,expertAnalysis
  });
 }catch(e){
  return NextResponse.json({success:false,message:e instanceof Error?e.message:"분석 오류"},{status:500});
 }
}

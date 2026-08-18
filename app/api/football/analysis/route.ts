import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const ESPN_CODES: Record<string,string> = { epl:"eng.1", laliga:"esp.1", bundesliga:"ger.1", seriea:"ita.1" };
const TEAM_KO: Record<string,string> = { Arsenal:"아스널","Coventry City":"코번트리 시티","Manchester City":"맨체스터 시티","Manchester United":"맨체스터 유나이티드",Liverpool:"리버풀",Chelsea:"첼시","Tottenham Hotspur":"토트넘 홋스퍼",Girona:"지로나","Real Betis":"레알 베티스","Borussia Dortmund":"보루시아 도르트문트",Como:"코모","AS Monaco":"AS 모나코",Espanyol:"에스파뇰",Watford:"왓퍼드",Wrexham:"렉섬",Portsmouth:"포츠머스" };
type Recent = { date:string; opponent:string; result:string; score:string; competition:string };

const browserHeaders = { "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36", Accept:"application/json,text/plain,*/*", "Accept-Language":"ko-KR,ko;q=0.9,en;q=0.7" };

async function fetchEspnSummary(code:string, gameId:string) {
  const source=`https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/summary?event=${gameId}`;
  const direct=await fetch(source,{headers:browserHeaders,cache:"no-store"}).catch(()=>null);
  if(direct?.ok) return direct.json();
  const proxy=await fetch(`https://r.jina.ai/http://site.api.espn.com/apis/site/v2/sports/soccer/${code}/summary?event=${gameId}`,{headers:browserHeaders,cache:"no-store"});
  if(!proxy.ok) throw new Error(`상세 분석 데이터 조회 실패 (${proxy.status})`);
  const text=await proxy.text(); const start=text.indexOf("{");
  if(start<0) throw new Error("상세 분석 응답을 해석하지 못했습니다.");
  return JSON.parse(text.slice(start));
}

function recentFromEspn(group:any):Recent[] {
  const teamId=String(group?.team?.id??"");
  return (group?.events??[]).slice(-5).reverse().map((event:any)=>{const isHome=String(event.homeTeamId)===teamId;let gf=Number(isHome?event.homeTeamScore:event.awayTeamScore);let ga=Number(isHome?event.awayTeamScore:event.homeTeamScore);if((event.gameResult==="W"&&gf<ga)||(event.gameResult==="L"&&gf>ga))[gf,ga]=[ga,gf];return{
    date:new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul"}).format(new Date(event.gameDate)),
    opponent:TEAM_KO[event.opponent?.displayName]??event.opponent?.displayName??"상대팀",
    result:event.gameResult==="W"?"승":event.gameResult==="L"?"패":"무", score:Number.isFinite(gf)&&Number.isFinite(ga)?`${gf}-${ga}`:event.score??"-", competition:event.leagueAbbreviation??event.competitionName??"",
  }});
}

function formStats(games:Recent[]) {
  const record={win:0,draw:0,loss:0,gf:0,ga:0};
  for(const game of games){if(game.result==="승")record.win++;else if(game.result==="패")record.loss++;else record.draw++;const [a,b]=game.score.split("-").map(Number);if(Number.isFinite(a)&&Number.isFinite(b)){record.gf+=a;record.ga+=b}}
  return {...record,avgFor:games.length?Number((record.gf/games.length).toFixed(2)):0,avgAgainst:games.length?Number((record.ga/games.length).toFixed(2)):0};
}

function findStandingEntries(node:any, output:any[]=[]):any[] {
  if(!node||typeof node!=="object")return output;
  if(Array.isArray(node.entries)) output.push(...node.entries);
  for(const value of Object.values(node)) if(value&&typeof value==="object") findStandingEntries(value,output);
  return output;
}

function standingFor(standings:any,id:string) {
  const entry=findStandingEntries(standings).find((item:any)=>String(item.team?.id)===id);
  const stats=Object.fromEntries((entry?.stats??[]).map((item:any)=>[item.name,item.value??item.displayValue]));
  return entry?{rank:Number(stats.rank??entry.position??0)||null,points:Number(stats.points??0),played:Number(stats.gamesPlayed??stats.games??0),wins:Number(stats.wins??0),draws:Number(stats.ties??stats.draws??0),losses:Number(stats.losses??0),goalDifference:Number(stats.pointDifferential??stats.goalDifference??0)}:null;
}

function expert(home:string,away:string,homeForm:any,awayForm:any,homeStanding:any,awayStanding:any,h2h:Recent[]) {
  let homeScore=1.2,awayScore=1;
  homeScore+=(homeForm.win-homeForm.loss)*0.32+(homeForm.avgFor-homeForm.avgAgainst)*0.25;
  awayScore+=(awayForm.win-awayForm.loss)*0.32+(awayForm.avgFor-awayForm.avgAgainst)*0.25;
  if(homeStanding?.rank&&awayStanding?.rank){homeScore+=(awayStanding.rank-homeStanding.rank)*0.05;awayScore+=(homeStanding.rank-awayStanding.rank)*0.05}
  const gap=homeScore-awayScore; const lean=Math.abs(gap)<0.45?"접전":gap>0?`${home} 우세`:`${away} 우세`;
  const totalAvg=homeForm.avgFor+homeForm.avgAgainst+awayForm.avgFor+awayForm.avgAgainst;
  const goalView=totalAvg>=5.2?"다득점 가능성이 비교적 높습니다.":totalAvg<=3.2?"저득점 흐름을 우선 경계할 경기입니다.":"득점 기대치는 중간 구간입니다.";
  const reasons=[`${home} 최근 ${homeForm.win}승 ${homeForm.draw}무 ${homeForm.loss}패, 경기당 ${homeForm.avgFor}득점·${homeForm.avgAgainst}실점`,`${away} 최근 ${awayForm.win}승 ${awayForm.draw}무 ${awayForm.loss}패, 경기당 ${awayForm.avgFor}득점·${awayForm.avgAgainst}실점`];
  if(homeStanding?.rank&&awayStanding?.rank) reasons.push(`리그 순위 ${home} ${homeStanding.rank}위, ${away} ${awayStanding.rank}위`);
  if(h2h.length) reasons.push(`확인된 최근 상대전적 ${h2h.length}경기 반영`);
  return {lean,goalView,confidence:Math.abs(gap)>=1.4?"높음":Math.abs(gap)>=0.65?"보통":"낮음",reasons,summary:`홈 이점과 최근 흐름을 함께 보면 ${lean} 구도입니다. ${goalView} 선발 명단과 당일 부상 변수가 반영되면 판단이 달라질 수 있습니다.`};
}

async function espnAnalysis(params:URLSearchParams) {
  const league=params.get("league")??""; const code=ESPN_CODES[league]; const gameId=params.get("gameId")??"";
  if(!code||!gameId) throw new Error("유럽 축구 경기 식별자가 없습니다.");
  const data=await fetchEspnSummary(code,gameId); const competition=data.header?.competitions?.[0]??{};
  const homeComp=competition.competitors?.find((item:any)=>item.homeAway==="home"); const awayComp=competition.competitors?.find((item:any)=>item.homeAway==="away");
  const home=params.get("home")??TEAM_KO[homeComp?.team?.displayName]??homeComp?.team?.displayName??"홈팀"; const away=params.get("away")??TEAM_KO[awayComp?.team?.displayName]??awayComp?.team?.displayName??"원정팀";
  const homeId=params.get("homeId")??String(homeComp?.team?.id??""); const awayId=params.get("awayId")??String(awayComp?.team?.id??"");
  const homeRecent=recentFromEspn((data.lastFiveGames??[]).find((x:any)=>String(x.team?.id)===homeId)); const awayRecent=recentFromEspn((data.lastFiveGames??[]).find((x:any)=>String(x.team?.id)===awayId));
  const h2h=(data.seasonseries??[]).flatMap((series:any)=>(series.events??[]).map((event:any)=>({date:event.date?new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul"}).format(new Date(event.date)):"",opponent:`${home} vs ${away}`,result:"",score:event.competitors?.map((c:any)=>c.score?.displayValue??c.score).join("-")??"-",competition:series.title??"상대전적"}))).slice(-5).reverse();
  const homeStanding=standingFor(data.standings,homeId),awayStanding=standingFor(data.standings,awayId); const homeForm=formStats(homeRecent),awayForm=formStats(awayRecent);
  const odds=(data.pickcenter??data.odds??[])[0]; const market=odds?{details:odds.details??odds.spread??null,overUnder:odds.overUnder??null,provider:odds.provider?.name??null}:null;
  const expertView=expert(home,away,homeForm,awayForm,homeStanding,awayStanding,h2h); const marketDetail=String(market?.details??""); const homeAbbr=String(homeComp?.team?.abbreviation??""); const awayAbbr=String(awayComp?.team?.abbreviation??"");
  if(/-\d+/.test(marketDetail)&&homeAbbr&&marketDetail.startsWith(homeAbbr)){expertView.lean=`${home} 우세`;expertView.confidence="높음";expertView.reasons.push(`시장 기준 ${marketDetail}로 홈팀 우세 반영`);expertView.summary=`최근 흐름은 양 팀 모두 좋지만 시장 기준과 홈 이점을 함께 보면 ${home} 우세 구도입니다. ${expertView.goalView} 선발 명단과 당일 부상 변수는 추가 확인이 필요합니다.`}
  else if(/-\d+/.test(marketDetail)&&awayAbbr&&marketDetail.startsWith(awayAbbr)){expertView.lean=`${away} 우세`;expertView.confidence="높음";expertView.reasons.push(`시장 기준 ${marketDetail}로 원정팀 우세 반영`);expertView.summary=`최근 흐름과 시장 기준을 함께 보면 ${away} 우세 구도입니다. ${expertView.goalView} 선발 명단과 당일 부상 변수는 추가 확인이 필요합니다.`}
  return {home,away,homeId,awayId,homeRecent,awayRecent,h2h,homeForm,awayForm,homeStanding,awayStanding,market,expert:expertView,source:"ESPN 경기 상세·리그 순위"};
}

async function fetchKMonth(year:string,month:string){const r=await fetch("https://www.kleague.com/getScheduleList.do",{method:"POST",headers:{"content-type":"application/json; charset=utf-8",accept:"application/json","user-agent":"Janggun-AI/1.0"},body:JSON.stringify({year,month,leagueId:1}),cache:"no-store"});if(!r.ok)throw new Error(`K리그 일정 조회 실패 (${r.status})`);const d=await r.json();return d.data??d}
function kRecent(list:any[],teamId:string,before:string):Recent[]{return list.filter(g=>g.endYn==="Y"&&g.gameDate<before&&(g.homeTeam===teamId||g.awayTeam===teamId)).sort((a,b)=>b.gameDate.localeCompare(a.gameDate)||String(b.gameTime).localeCompare(String(a.gameTime))).slice(0,5).map(g=>{const home=g.homeTeam===teamId;const gf=Number(home?g.homeGoal:g.awayGoal),ga=Number(home?g.awayGoal:g.homeGoal);return{date:g.gameDate.replaceAll(".","-"),opponent:home?g.awayTeamName:g.homeTeamName,result:gf>ga?"승":gf<ga?"패":"무",score:`${gf}-${ga}`,competition:g.meetName??"K리그1"}})}
async function kleagueAnalysis(params:URLSearchParams){const date=params.get("date")??"";const home=params.get("home")??"홈팀",away=params.get("away")??"원정팀",homeId=params.get("homeId")??"",awayId=params.get("awayId")??"";const base=new Date(`${date}T00:00:00+09:00`);const months=Array.from({length:6},(_,i)=>{const d=new Date(base);d.setMonth(d.getMonth()-i);return[String(d.getFullYear()),String(d.getMonth()+1).padStart(2,"0")]});const payloads=await Promise.all(months.map(([y,m])=>fetchKMonth(y,m)));const rawGames=payloads.flatMap(x=>x.scheduleList??[]);const games=Array.from(new Map(rawGames.map((g:any)=>[String(g.gameId??g.scheduleId??`${g.gameDate}|${g.gameTime}|${g.homeTeam}|${g.awayTeam}`),g])).values()) as any[];const homeRecent=kRecent(games,homeId,date.replaceAll("-",".")),awayRecent=kRecent(games,awayId,date.replaceAll("-","."));const h2h=games.filter(g=>g.endYn==="Y"&&g.gameDate<date.replaceAll("-",".")&&((g.homeTeam===homeId&&g.awayTeam===awayId)||(g.homeTeam===awayId&&g.awayTeam===homeId))).sort((a,b)=>b.gameDate.localeCompare(a.gameDate)).slice(0,5).map(g=>({date:g.gameDate.replaceAll(".","-"),opponent:`${home} vs ${away}`,result:"",score:`${g.homeGoal}-${g.awayGoal}`,competition:g.meetName??"K리그1"}));const rankUrl=`https://www.kleague.com/record/teamRank.do?leagueId=1&year=${date.slice(0,4)}&stadium=all&recordType=rank`;const rankRes=await fetch(rankUrl,{method:"POST",headers:browserHeaders,cache:"no-store"});const rankData=rankRes.ok?await rankRes.json():{};const rows=rankData.data?.teamRank??rankData.teamRank??[];const standing=(id:string)=>{const x=rows.find((r:any)=>r.teamId===id);return x?{rank:Number(x.rank),points:Number(x.gainPoint),played:Number(x.gameCount),wins:Number(x.winCnt),draws:Number(x.tieCnt),losses:Number(x.lossCnt),goalDifference:Number(x.gapCnt)}:null};const homeStanding=standing(homeId),awayStanding=standing(awayId),homeForm=formStats(homeRecent),awayForm=formStats(awayRecent);return{home,away,homeId,awayId,homeRecent,awayRecent,h2h,homeForm,awayForm,homeStanding,awayStanding,market:null,expert:expert(home,away,homeForm,awayForm,homeStanding,awayStanding,h2h),source:"K리그 공식 일정·순위"}}

export async function GET(request:NextRequest){try{const league=request.nextUrl.searchParams.get("league")??"";const analysis=league==="kleague"?await kleagueAnalysis(request.nextUrl.searchParams):await espnAnalysis(request.nextUrl.searchParams);return NextResponse.json({success:true,...analysis,updatedAt:new Date().toISOString()},{headers:{"Cache-Control":"public, s-maxage=600, stale-while-revalidate=1200"}})}catch(error){return NextResponse.json({success:false,message:error instanceof Error?error.message:"축구 분석을 불러오지 못했습니다."},{status:502})}}

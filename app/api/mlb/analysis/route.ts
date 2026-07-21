import { NextResponse } from "next/server";
import { MLB_TEAM_KO_BY_ID, playerNameKo, teamNameKo } from "../../../lib/mlb-ko";

type AnyObject = Record<string, any>;

function num(v: unknown) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function text(v: unknown) { return v == null ? "" : String(v); }
function koreaDate(d: Date) { return new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Seoul", year:"numeric", month:"2-digit", day:"2-digit" }).format(d); }
function shiftDate(date: string, days: number) { const d = new Date(`${date}T12:00:00+09:00`); d.setDate(d.getDate()+days); return koreaDate(d); }
async function getJson(url: string) {
  const r = await fetch(url, { headers:{Accept:"application/json","User-Agent":"Sports-AI/3.0"}, next:{revalidate:300} });
  if (!r.ok) throw new Error(`MLB ?곗씠???붿껌 ?ㅽ뙣 (${r.status})`);
  return r.json();
}

function statBlock(payload: AnyObject, type: string) {
  return payload?.stats?.find((s: AnyObject) => s?.type?.displayName === type)?.splits?.[0]?.stat ?? {};
}
function gameLog(payload: AnyObject) {
  return payload?.stats?.find((s: AnyObject) => s?.type?.displayName === "gameLog")?.splits ?? [];
}
function summary(rows: Array<{ innings: string; earnedRuns: number; walks: number; hits: number; strikeouts: number }>) {
  const outs = rows.reduce((sum, row) => {
    const [whole, decimal] = String(row.innings).split(".");
    return sum + num(whole) * 3 + num(decimal);
  }, 0);
  const innings = outs ? `${Math.floor(outs / 3)}.${outs % 3}` : "0.0";
  const ip = outs / 3;
  const er = rows.reduce((s, x) => s + x.earnedRuns, 0);
  const walks = rows.reduce((s, x) => s + x.walks, 0);
  const hits = rows.reduce((s, x) => s + x.hits, 0);
  return {
    games: rows.length,
    innings,
    era: ip ? (er * 9 / ip).toFixed(2) : "-",
    whip: ip ? ((walks + hits) / ip).toFixed(2) : "-",
    strikeouts: rows.reduce((s, x) => s + x.strikeouts, 0),
    walks,
  };
}

async function teamStats(teamId: number, season: string) {
  const data = await getJson(`https://statsapi.mlb.com/api/v1/teams/${teamId}/stats?stats=season&group=hitting,pitching&season=${season}`);
  const groups = data?.stats ?? [];
  const hit = groups.find((s:AnyObject)=>s?.group?.displayName==="hitting")?.splits?.[0]?.stat ?? {};
  const pitch = groups.find((s:AnyObject)=>s?.group?.displayName==="pitching")?.splits?.[0]?.stat ?? {};
  return {
    teamId, team: MLB_TEAM_KO_BY_ID[teamId] ?? "",
    hitting: { avg:text(hit.avg)||"-", obp:text(hit.obp)||"-", slg:text(hit.slg)||"-", ops:text(hit.ops)||"-", runs:num(hit.runs), hits:num(hit.hits), doubles:num(hit.doubles), triples:num(hit.triples), homeRuns:num(hit.homeRuns), baseOnBalls:num(hit.baseOnBalls), strikeOuts:num(hit.strikeOuts) },
    pitching: { era:text(pitch.era)||"-", whip:text(pitch.whip)||"-", innings:text(pitch.inningsPitched)||"-", wins:num(pitch.wins), losses:num(pitch.losses), runs:num(pitch.runs), earnedRuns:num(pitch.earnedRuns), homeRuns:num(pitch.homeRuns), baseOnBalls:num(pitch.baseOnBalls), strikeOuts:num(pitch.strikeOuts) }
  };
}

async function pitcherStats(playerId: number, season: string, opponentId: number) {
  if (!playerId) return null;
  const [person, stats] = await Promise.all([
    getJson(`https://statsapi.mlb.com/api/v1/people/${playerId}`),
    getJson(`https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=season,gameLog&group=pitching&season=${season}`)
  ]);
  const p = person?.people?.[0] ?? {};
  const seasonStat = statBlock(stats, "season");
  const logs = gameLog(stats).slice(-10).reverse().map((row:AnyObject)=>({
    date: row.date ?? "", opponent: teamNameKo(row.opponent?.name ?? "", row.opponent?.id), isHome: row.isHome ?? false,
    innings: text(row.stat?.inningsPitched)||"0", runs:num(row.stat?.runs), earnedRuns:num(row.stat?.earnedRuns), hits:num(row.stat?.hits), walks:num(row.stat?.baseOnBalls), strikeouts:num(row.stat?.strikeOuts), pitches:num(row.stat?.numberOfPitches), decision:text(row.stat?.decision)
  }));
  const homeRows = logs.filter((x:AnyObject)=>x.isHome);
  const awayRows = logs.filter((x:AnyObject)=>!x.isHome);
  const opponentKo = MLB_TEAM_KO_BY_ID[opponentId] ?? "?곷??";
  const opponentRows = logs.filter((x:AnyObject)=>x.opponent===opponentKo);
  return {
    id:playerId, name:playerNameKo(p.fullName ?? ""), originalName:p.fullName ?? "", throws:p.pitchHand?.description === "Right" ? "?고닾" : p.pitchHand?.description === "Left" ? "醫뚰닾" : "",
    season:{ games:num(seasonStat.gamesPlayed), gamesStarted:num(seasonStat.gamesStarted), wins:num(seasonStat.wins), losses:num(seasonStat.losses), era:text(seasonStat.era)||"-", whip:text(seasonStat.whip)||"-", innings:text(seasonStat.inningsPitched)||"-", walks:num(seasonStat.baseOnBalls), strikeouts:num(seasonStat.strikeOuts), hits:num(seasonStat.hits), homeRuns:num(seasonStat.homeRuns) },
    recent5: summary(logs.slice(0,5)), recent10Summary: summary(logs), homeSummary:summary(homeRows), awaySummary:summary(awayRows), opponentSummary:summary(opponentRows), recent10:logs
  };
}

async function recentGames(teamId:number, date:string) {
  const start=shiftDate(date,-24); const end=shiftDate(date,-1);
  const data=await getJson(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${teamId}&startDate=${start}&endDate=${end}&hydrate=linescore,team`);
  const games=(data?.dates??[]).flatMap((d:AnyObject)=>d.games??[]).filter((g:AnyObject)=>g.status?.abstractGameState==="Final").slice(-10).reverse();
  return games.map((g:AnyObject)=>{
    const isHome=g.teams?.home?.team?.id===teamId;
    const own=isHome?g.teams?.home:g.teams?.away; const opp=isHome?g.teams?.away:g.teams?.home;
    const ownScore=num(own?.score), oppScore=num(opp?.score);
    return { date:(g.officialDate??""), opponent:teamNameKo(opp?.team?.name??"",opp?.team?.id), home:isHome, runs:ownScore, allowed:oppScore, result:ownScore>oppScore?"승":ownScore<oppScore?"패":"무", gamePk:g.gamePk };
  });
}

async function headToHead(awayId:number, homeId:number, season:string, date:string) {
  const data=await getJson(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${awayId}&opponentId=${homeId}&season=${season}&startDate=${season}-01-01&endDate=${date}&hydrate=team`);
  const games=(data?.dates??[]).flatMap((d:AnyObject)=>d.games??[]).filter((g:AnyObject)=>g.status?.abstractGameState==="Final");
  let awayWins=0, homeWins=0, draws=0, awayRuns=0, homeRuns=0;
  const rows=games.map((g:AnyObject)=>{
    const a=num(g.teams?.away?.score), h=num(g.teams?.home?.score); const actualAwayId=g.teams?.away?.team?.id;
    const targetAwayScore=actualAwayId===awayId?a:h; const targetHomeScore=actualAwayId===awayId?h:a;
    awayRuns+=targetAwayScore; homeRuns+=targetHomeScore;
    if(targetAwayScore>targetHomeScore)awayWins++; else if(targetAwayScore<targetHomeScore)homeWins++; else draws++;
    return {date:g.officialDate, away:teamNameKo(g.teams?.away?.team?.name??"",g.teams?.away?.team?.id), home:teamNameKo(g.teams?.home?.team?.name??"",g.teams?.home?.team?.id), awayScore:a, homeScore:h};
  });
  return {games:rows.length, awayWins, awayLosses:homeWins, homeWins, homeLosses:awayWins, draws, awayRuns, homeRuns, recent:rows.slice(-10).reverse()};
}

async function bullpen(teamId:number,date:string) {
  const recent=await recentGames(teamId,date); const targets=recent.slice(0,3); const lines:any[]=[];
  for(const game of targets){
    try{
      const box=await getJson(`https://statsapi.mlb.com/api/v1/game/${game.gamePk}/boxscore`);
      const side=box?.teams?.home?.team?.id===teamId?box.teams.home:box.teams.away;
      const pitchers=(side?.pitchers??[]).slice(1);
      for(const id of pitchers){ const row=side?.players?.[`ID${id}`]; const s=row?.stats?.pitching??{}; lines.push({date:game.date,name:playerNameKo(row?.person?.fullName??""),innings:text(s.inningsPitched)||"0",pitches:num(s.pitchesThrown),strikeouts:num(s.strikeOuts),walks:num(s.baseOnBalls),runs:num(s.runs)}); }
    }catch{}
  }
  const latest=targets[0]?.date; const latestLines=lines.filter(x=>x.date===latest); const totalPitches=lines.reduce((s,x)=>s+x.pitches,0); const yesterdayPitches=latestLines.reduce((s,x)=>s+x.pitches,0);
  const datesByPitcher=new Map<string,Set<string>>(); lines.forEach(x=>{if(!datesByPitcher.has(x.name))datesByPitcher.set(x.name,new Set());datesByPitcher.get(x.name)?.add(x.date)});
  const consecutive=[...datesByPitcher.entries()].filter(([,s])=>s.size>=2).map(([name])=>name);
  const heavy=latestLines.filter(x=>x.pitches>=25).map(x=>x.name);
  const score=Math.min(100,Math.round(yesterdayPitches*.65+(totalPitches-yesterdayPitches)*.25+consecutive.length*13+heavy.length*8));
  return {score,label:score>=75?"留ㅼ슦 ?믪쓬":score>=50?"?믪쓬":score>=25?"蹂댄넻":"??쓬",latestGameDate:latest??null,yesterdayPitches,recent3GamePitches:totalPitches,consecutivePitchers:consecutive.length,consecutiveNames:consecutive,heavyPitchers:heavy.length,heavyNames:heavy,pitchers:latestLines,recent3Days:targets.map((g: any)=>({date:g.date,pitchers:lines.filter(x=>x.date===g.date)}))};
}

export async function GET(request:Request){
  const p=new URL(request.url).searchParams; const date=p.get("date")??koreaDate(new Date()); const season=date.slice(0,4);
  const awayId=num(p.get("awayTeamId")), homeId=num(p.get("homeTeamId")); const awayStarterId=num(p.get("awayStarterId")), homeStarterId=num(p.get("homeStarterId"));
  if(!awayId||!homeId) return NextResponse.json({success:false,message:"? ?뺣낫媛 ?꾩슂?⑸땲??"},{status:400});
  try{
    const [awayTeam,homeTeam,awayPitcher,homePitcher,awayRecent,homeRecent,h2h,awayBullpen,homeBullpen]=await Promise.all([
      teamStats(awayId,season),teamStats(homeId,season),pitcherStats(awayStarterId,season,homeId),pitcherStats(homeStarterId,season,awayId),recentGames(awayId,date),recentGames(homeId,date),headToHead(awayId,homeId,season,date),bullpen(awayId,date),bullpen(homeId,date)
    ]);
    return NextResponse.json({success:true,updatedAt:new Date().toISOString(),awayTeam,homeTeam,awayPitcher,homePitcher,awayRecent,homeRecent,headToHead:h2h,awayBullpen,homeBullpen});
  }catch(error){ return NextResponse.json({success:false,message:error instanceof Error?error.message:"MLB ?곸꽭 遺꾩꽍??遺덈윭?ㅼ? 紐삵뻽?듬땲??"},{status:500}); }
}


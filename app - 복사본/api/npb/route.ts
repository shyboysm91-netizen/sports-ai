import { NextResponse } from "next/server";
import { playerNameKo } from "./_shared";

const TEAMS: Record<string,string> = {
  "Hanshin":"한신 타이거스","Yomiuri":"요미우리 자이언츠","DeNA":"요코하마 DeNA 베이스타스",
  "Chunichi":"주니치 드래건스","Hiroshima":"히로시마 도요 카프","Yakult":"도쿄 야쿠르트 스왈로스",
  "SoftBank":"후쿠오카 소프트뱅크 호크스","Nippon-Ham":"홋카이도 닛폰햄 파이터스","ORIX":"오릭스 버팔로스",
  "Rakuten":"도호쿠 라쿠텐 골든이글스","Seibu":"사이타마 세이부 라이온스","Lotte":"지바 롯데 마린스"
};

const STADIUMS=["Jingu","Tokyo Dome","Yokohama","Vantelin Dome","Mazda Stadium","Koshien","MIZUHO PayPay","Mizuho PayPay","ES CON FIELD","Kyocera Dome","Rakuten Mobile","Belluna Dome","ZOZO Marine","Hotto Motto","Kurashiki","Matsuyama","Naha"];

function clean(s:string){
  return s.replace(/<script[\s\S]*?<\/script>/gi,"")
    .replace(/<style[\s\S]*?<\/style>/gi,"")
    .replace(/<[^>]+>/g," ")
    .replace(/&nbsp;/g," ")
    .replace(/&amp;/g,"&")
    .replace(/&#39;/g,"'")
    .replace(/\s+/g," ")
    .trim();
}

function jpStadium(s:string){
  const map:Record<string,string>={
    "Jingu":"메이지 진구","Tokyo Dome":"도쿄 돔","Yokohama":"요코하마 스타디움",
    "Vantelin Dome":"반테린 돔","Mazda Stadium":"마쓰다 스타디움","Koshien":"한신 고시엔",
    "Mizuho PayPay":"미즈호 PayPay 돔","MIZUHO PayPay":"미즈호 PayPay 돔","ES CON FIELD":"에스콘 필드","Kyocera Dome":"교세라 돔",
    "Rakuten Mobile":"라쿠텐 모바일 파크","Belluna Dome":"벨루나 돔","ZOZO Marine":"ZOZO 마린"
  };
  return map[s]||s;
}

function starterFromChunk(chunk:string, teamApiName:string){
  const patterns = [
    new RegExp(`${teamApiName}\\s+(?:Starting Pitcher|Starter|Probable Pitcher)\\s*[:：]?\\s*([A-Z][A-Za-z'\\-]+(?:,\\s*[A-Z][A-Za-z'\\-]+|\\s+[A-Z][A-Za-z'\\-]+){1,2})`, "i"),
    new RegExp(`(?:Starting Pitcher|Starter|Probable Pitcher)\\s*[:：]?\\s*([A-Z][A-Za-z'\\-]+(?:,\\s*[A-Z][A-Za-z'\\-]+|\\s+[A-Z][A-Za-z'\\-]+){1,2})\\s+${teamApiName}`, "i"),
  ];
  for (const pattern of patterns){
    const match = chunk.match(pattern);
    if (match?.[1]) return playerNameKo(match[1].trim());
  }
  return "";
}


function escapeRe(value:string){
  return value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
}

function parseFinishedRows(html:string,date:string){
  const games:any[]=[];
  const seen=new Set<string>();
  const teamNames=Object.keys(TEAMS).sort((a,b)=>b.length-a.length);
  const teamPattern=teamNames.map(escapeRe).join("|");
  const stadiumPattern=STADIUMS.sort((a,b)=>b.length-a.length).map(escapeRe).join("|");
  const rows=html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];

  for(const rawRow of rows){
    const row=clean(rawRow);
    const teams=[...row.matchAll(new RegExp(`\\b(${teamPattern})\\b`,"gi"))].map(m=>m[1]);
    const unique=teams.filter((team,index)=>teams.findIndex(t=>t.toLowerCase()===team.toLowerCase())===index);
    if(unique.length<2) continue;
    const awayApi=teamNames.find(t=>t.toLowerCase()===unique[0].toLowerCase());
    const homeApi=teamNames.find(t=>t.toLowerCase()===unique[1].toLowerCase());
    if(!awayApi||!homeApi||awayApi===homeApi) continue;

    const stadiumMatch=row.match(new RegExp(`(${stadiumPattern})`,"i"));
    const stadium=stadiumMatch?.[1] ?? "";
    const timeMatch=row.match(/\b([0-2]?\d:[0-5]\d)\b/);

    let awayScore:number|undefined;
    let homeScore:number|undefined;
    const directPatterns=[
      new RegExp(`${escapeRe(awayApi)}\\s+(\\d{1,2})\\s*[-–—:]\\s*(\\d{1,2})\\s+${escapeRe(homeApi)}`,"i"),
      new RegExp(`${escapeRe(awayApi)}\\s+(\\d{1,2})\\s+(?:Game\\s+\\d+\\s+)?(?:${stadiumPattern})?\\s*(\\d{1,2})\\s+${escapeRe(homeApi)}`,"i"),
      new RegExp(`${escapeRe(awayApi)}[\\s\\S]*?\\b(\\d{1,2})\\b\\s*[-–—:]?\\s*\\b(\\d{1,2})\\b[\\s\\S]*?${escapeRe(homeApi)}`,"i"),
    ];
    for(const pattern of directPatterns){
      const m=row.match(pattern);
      if(m){
        const a=Number(m[1]),h=Number(m[2]);
        if(a<=30&&h<=30){awayScore=a;homeScore=h;break;}
      }
    }

    // HTML 셀 단위 점수도 확인합니다. 시간, 경기 번호, 관중 수는 제외합니다.
    if(awayScore===undefined||homeScore===undefined){
      const cells=(rawRow.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi)??[]).map(clean);
      const awayIndex=cells.findIndex(c=>new RegExp(`\\b${escapeRe(awayApi)}\\b`,"i").test(c));
      const homeIndex=cells.findIndex(c=>new RegExp(`\\b${escapeRe(homeApi)}\\b`,"i").test(c));
      if(awayIndex>=0&&homeIndex>awayIndex){
        const between=cells.slice(awayIndex+1,homeIndex).filter(c=>/^\d{1,2}$/.test(c)).map(Number).filter(n=>n<=30);
        if(between.length>=2){awayScore=between[0];homeScore=between[between.length-1];}
      }
    }

    const finalMarker=/Final|Game\s*Set|試合終了|終了/i.test(row);
    const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    const hasScores=awayScore!==undefined&&homeScore!==undefined;
    const completed=hasScores&&(finalMarker||(date<today&&(awayScore!==0||homeScore!==0)));
    if(!completed){awayScore=undefined;homeScore=undefined;}
    const key=`${date}-${awayApi}-${homeApi}-${stadium}`;
    if(seen.has(key)) continue;
    seen.add(key);
    games.push({
      league:"NPB",date,time:timeMatch?.[1]??"",away:TEAMS[awayApi],home:TEAMS[homeApi],stadium:jpStadium(stadium),
      awayStarter:"",homeStarter:"",awayStarterCode:"",homeStarterCode:"",awayApiName:awayApi,homeApiName:homeApi,
      starterStatus:completed?"finished":"not-announced",awayScore,homeScore,completed,status:completed?"Final":"Scheduled",
    });
  }
  return games;
}


type EspnCompetitor = {
  homeAway?: "home" | "away";
  score?: string;
  team?: { displayName?: string; shortDisplayName?: string; name?: string; abbreviation?: string };
};

const ESPN_TEAM_ALIASES: Array<[RegExp, string]> = [
  [/yomiuri|giants/i, "Yomiuri"], [/yakult|swallows/i, "Yakult"], [/hanshin|tigers/i, "Hanshin"],
  [/deNA|baystars/i, "DeNA"], [/hiroshima|carp/i, "Hiroshima"], [/chunichi|dragons/i, "Chunichi"],
  [/softbank|hawks/i, "SoftBank"], [/nippon.ham|fighters/i, "Nippon-Ham"], [/orix|buffaloes/i, "ORIX"],
  [/rakuten|golden eagles/i, "Rakuten"], [/seibu|lions/i, "Seibu"], [/lotte|marines/i, "Lotte"],
];

function espnTeamName(value:string){
  for(const [pattern,key] of ESPN_TEAM_ALIASES) if(pattern.test(value)) return key;
  return "";
}

async function loadEspnResults(date:string){
  const compact=date.replaceAll("-","");
  const slugs=["japanese-npb","npb","nippon-professional-baseball"];
  for(const slug of slugs){
    try{
      const response=await fetch(`https://site.api.espn.com/apis/site/v2/sports/baseball/${slug}/scoreboard?dates=${compact}`,{
        headers:{"User-Agent":"Mozilla/5.0","Accept":"application/json"},cache:"no-store",
      });
      if(!response.ok) continue;
      const json=await response.json() as any;
      const events=Array.isArray(json?.events)?json.events:[];
      const games:any[]=[];
      for(const event of events){
        const competition=event?.competitions?.[0];
        const competitors:Array<EspnCompetitor>=Array.isArray(competition?.competitors)?competition.competitors:[];
        const awayC=competitors.find((c)=>c.homeAway==="away");
        const homeC=competitors.find((c)=>c.homeAway==="home");
        if(!awayC||!homeC) continue;
        const awayApi=espnTeamName(`${awayC.team?.displayName??""} ${awayC.team?.shortDisplayName??""} ${awayC.team?.name??""} ${awayC.team?.abbreviation??""}`);
        const homeApi=espnTeamName(`${homeC.team?.displayName??""} ${homeC.team?.shortDisplayName??""} ${homeC.team?.name??""} ${homeC.team?.abbreviation??""}`);
        if(!awayApi||!homeApi) continue;
        const awayScore=/^\d+$/.test(String(awayC.score??""))?Number(awayC.score):undefined;
        const homeScore=/^\d+$/.test(String(homeC.score??""))?Number(homeC.score):undefined;
        const completed=Boolean(competition?.status?.type?.completed)||(awayScore!==undefined&&homeScore!==undefined&&/final/i.test(String(competition?.status?.type?.name??competition?.status?.type?.description??"")));
        games.push({
          league:"NPB",date,time:"",away:TEAMS[awayApi],home:TEAMS[homeApi],stadium:String(competition?.venue?.fullName??""),
          awayStarter:"",homeStarter:"",awayStarterCode:"",homeStarterCode:"",awayApiName:awayApi,homeApiName:homeApi,
          starterStatus:completed?"finished":"not-announced",awayScore:completed?awayScore:undefined,homeScore:completed?homeScore:undefined,
          completed,status:String(competition?.status?.type?.description??competition?.status?.type?.name??""),
        });
      }
      if(games.length) return games;
    }catch{/* 다음 slug 시도 */}
  }
  return [];
}

function mergeGameResults(primary:any[],results:any[]){
  const byMatch=new Map(results.map((g)=>[`${g.awayApiName}-${g.homeApiName}`,g]));
  const merged=primary.map((game)=>{
    const result=byMatch.get(`${game.awayApiName}-${game.homeApiName}`);
    return result&&result.completed?{...game,awayScore:result.awayScore,homeScore:result.homeScore,completed:true,status:result.status||"Final"}:game;
  });
  const existing=new Set(merged.map((g)=>`${g.awayApiName}-${g.homeApiName}`));
  for(const result of results) if(!existing.has(`${result.awayApiName}-${result.homeApiName}`)) merged.push(result);
  return merged;
}

export const revalidate=300;

export async function GET(req:Request){
 try{
  const date=new URL(req.url).searchParams.get("date")||new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const year=date.slice(0,4), compact=date.replaceAll("-","");
  const url=`https://npb.jp/bis/eng/${year}/games/gm${compact}.html`;
  const r=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0","Accept":"text/html"},cache:"no-store"});
  if(!r.ok) return NextResponse.json({success:true,games:[],message:"NPB 공식 일정이 아직 게시되지 않았습니다.",source:url});
  const html=await r.text();
  const text=clean(html);
  const rowGames=parseFinishedRows(html,date);
  const games:any[]=[...rowGames];
  const seen=new Set<string>(rowGames.map((g)=>`${g.awayApiName}-${g.homeApiName}-${g.stadium}`));
  const teamPattern=Object.keys(TEAMS).sort((a,b)=>b.length-a.length).map((name)=>name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|");
  const stadiumPattern=STADIUMS.sort((a,b)=>b.length-a.length).map((name)=>name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|");

  // 종료 경기: 공식 페이지의 여러 텍스트 표기를 모두 지원합니다.
  const simpleScoreRe=new RegExp(`(${teamPattern})\\s+(\\d{1,2})\\s*[-–—:]\\s*(\\d{1,2})\\s+(${teamPattern})`,"gi");
  for(const match of text.matchAll(simpleScoreRe)){
    const first=match[1], firstScore=Number(match[2]), secondScore=Number(match[3]), second=match[4];
    if(first===second||firstScore>30||secondScore>30||(firstScore===0&&secondScore===0)) continue;
    const key=`${first}-${second}-`;
    if([...seen].some(v=>v.startsWith(`${first}-${second}-`))) continue;
    seen.add(key);
    games.push({league:"NPB",date,time:"",away:TEAMS[first],home:TEAMS[second],stadium:"",awayStarter:"",homeStarter:"",awayStarterCode:"",homeStarterCode:"",awayApiName:first,homeApiName:second,starterStatus:"finished",awayScore:firstScore,homeScore:secondScore,completed:true,status:"Final"});
  }

  // 종료 경기: "Yomiuri 3 Game 9 Tokyo Dome 1 Hiroshima" 형태
  const scoreRe=new RegExp(`(${teamPattern})\\s+(\\d{1,2})\\s+Game\\s+\\d+\\s+(${stadiumPattern})\\s+(\\d{1,2})\\s+(${teamPattern})`,"gi");
  for(const match of text.matchAll(scoreRe)){
    const first=match[1], firstScore=Number(match[2]), stadium=match[3], secondScore=Number(match[4]), second=match[5];
    if(first===second) continue;
    const key=`${first}-${second}-${stadium}`;
    if(seen.has(key) || [...seen].some((value)=>value.startsWith(`${first}-${second}-`))) continue;
    seen.add(key);
    games.push({
      league:"NPB",date,time:"",away:TEAMS[first],home:TEAMS[second],stadium:jpStadium(stadium),
      awayStarter:"",homeStarter:"",awayStarterCode:"",homeStarterCode:"",
      awayApiName:first,homeApiName:second,starterStatus:"finished",
      awayScore:firstScore,homeScore:secondScore,completed:true,status:"Final",
    });
  }

  // 예정 경기: "SoftBank MIZUHO PayPay 18:00 ORIX" 형태
  const scheduleRe=new RegExp(`(${teamPattern})\\s+(${stadiumPattern})\\s+([0-2]?\\d:[0-5]\\d)\\s+(${teamPattern})`,"gi");
  for(const match of text.matchAll(scheduleRe)){
    const first=match[1], stadium=match[2], tm=match[3], second=match[4];
    if(first===second) continue;
    const key=`${first}-${second}-${stadium}`;
    if(seen.has(key) || [...seen].some((value)=>value.startsWith(`${first}-${second}-`))) continue;
    seen.add(key);
    const chunk=text.slice(Math.max(0,(match.index??0)-240),(match.index??0)+match[0].length+240);
    games.push({
      league:"NPB",date,time:tm,away:TEAMS[first],home:TEAMS[second],stadium:jpStadium(stadium),
      awayStarter:starterFromChunk(chunk,first),homeStarter:starterFromChunk(chunk,second),
      awayStarterCode:"",homeStarterCode:"",awayApiName:first,homeApiName:second,
      starterStatus:"not-announced",completed:false,status:"Scheduled",
    });
  }

  const espnResults=await loadEspnResults(date);
  const mergedGames=mergeGameResults(games,espnResults);
  return NextResponse.json({success:true,games:mergedGames,source:espnResults.length?`${url} + ESPN scoreboard fallback`:url,count:mergedGames.length});
 }catch(e){
   return NextResponse.json({success:false,games:[],message:e instanceof Error?e.message:"NPB 일정 오류"},{status:500});
 }
}

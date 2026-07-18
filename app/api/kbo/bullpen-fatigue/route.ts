import { NextResponse } from "next/server";

type Line={name:string;innings:string;pitches:number;battersFaced:number;date:string;consecutiveDays:number};
const BASE="https://mykbostats.com";
const HEADERS={"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36",Accept:"text/html,application/xhtml+xml"};
const TEAM_SLUG:Record<string,string>={DOOSAN:"Doosan",HANWHA:"Hanwha",KIA:"Kia",KIWOOM:"Kiwoom",KT:"KT",LG:"LG",LOTTE:"Lotte",NC:"NC",SAMSUNG:"Samsung",SSG:"SSG"};
const TEAM_SCHEDULE:Record<string,string>={DOOSAN:"3-Doosan-Bears",HANWHA:"4-Hanwha-Eagles",KIA:"5-Kia-Tigers",KIWOOM:"8-Kiwoom-Heroes",KT:"22-KT-Wiz",LG:"6-LG-Twins",LOTTE:"7-Lotte-Giants",NC:"9-NC-Dinos",SAMSUNG:"10-Samsung-Lions",SSG:"11-SSG-Landers"};
const ALIASES:Record<string,string[]>={KIA:["KIA","기아","타이거즈"],SAMSUNG:["삼성","라이온즈"],LG:["LG","엘지","트윈스"],DOOSAN:["두산","베어스","OB"],KT:["KT","위즈"],SSG:["SSG","SK","랜더스"],LOTTE:["롯데","자이언츠"],HANWHA:["한화","이글스"],NC:["NC","엔씨","다이노스"],KIWOOM:["키움","히어로즈"]};
function decode(s:string){return s.replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/&#39;/gi,"'").replace(/&quot;/gi,'"').replace(/&frac13;|⅓/gi," 1/3").replace(/&frac23;|⅔/gi," 2/3");}
function clean(s:string){return decode(s).replace(/<script[\s\S]*?<\/script>/gi,"").replace(/<style[\s\S]*?<\/style>/gi,"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();}
function cells(row:string){return (row.match(/<t[dh]\b[^>]*>[\s\S]*?<\/t[dh]>/gi)??[]).map(clean);}
function n(s:string|undefined){const x=Number((s??"").replace(/,/g,"").replace(/[^0-9.-]/g,""));return Number.isFinite(x)?x:0;}
function ip(v:string){const s=v.trim();const m=s.match(/^(\d+)\s+(1\/3|2\/3)$/);if(m)return +m[1]+(m[2]==="1/3"?1/3:2/3);if(s==="1/3")return 1/3;if(s==="2/3")return 2/3;return n(s);}
function norm(s:string){return s.toLowerCase().replace(/[^0-9a-z가-힣]/g,"");}
function teamCode(v:string){const z=norm(v);for(const [k,a] of Object.entries(ALIASES))if(a.some(x=>z.includes(norm(x))))return k;return "";}
async function get(url:string){const r=await fetch(url,{headers:HEADERS,cache:"no-store"});if(!r.ok)throw new Error(`MyKBO ${r.status}`);return r.text();}
function ymd(d:Date){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);}
function allowedDates(target:string){const base=new Date(`${target}T12:00:00+09:00`),out:string[]=[];for(let i=1;i<=3;i++){const d=new Date(base);d.setDate(d.getDate()-i);out.push(ymd(d));}return out;}
function gameLinks(html:string,code:string,dates:string[]){const slug=TEAM_SLUG[code];const out:string[]=[];for(const m of html.matchAll(/href=["'](\/games\/\d+-[^"']+-(\d{8}))["']/gi)){const href=m[1],date=`${m[2].slice(0,4)}-${m[2].slice(4,6)}-${m[2].slice(6,8)}`;if(!dates.includes(date)||!new RegExp(`(?:^|-)${slug}(?:-|$)`,`i`).test(href))continue;out.push(href);}return [...new Set(out)];}
function pitcherTables(html:string){const marker=html.search(/>\s*Pitching\s*</i);const part=marker>=0?html.slice(marker):html;return (part.match(/<table\b[^>]*>[\s\S]*?<\/table>/gi)??[]).filter(t=>/\bERA\b/i.test(clean(t))&&/\bIP\b/i.test(clean(t))&&/\bNP\b/i.test(clean(t)));}
function parseGame(html:string,code:string,date:string):Line[]{
  const slug=TEAM_SLUG[code]; const out:Line[]=[];
  for(const table of pitcherTables(html)){
    const context=clean(html.slice(Math.max(0,html.indexOf(table)-500),html.indexOf(table)));
    if(!new RegExp(`\\b${slug}\\b`,`i`).test(context))continue;
    const rows=table.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)??[];
    let playerIndex=0;
    for(const row of rows){
      const c=cells(row); if(c.length<3||/ERA\s+IP\s+NP/i.test(c.join(" ")))continue;
      const link=row.match(/href=["']\/players\/\d+-[^"']+["'][^>]*>([\s\S]*?)<\/a>/i);
      if(!link)continue;
      const name=clean(link[1]);
      // 첫 열이 이름, 이후 ERA IP NP ...
      const idx=c.findIndex(x=>norm(x)===norm(name));
      const eraIdx=idx>=0?idx+1:1;
      const innings=c[eraIdx+1]??"0";
      const pitches=n(c[eraIdx+2]);
      if(playerIndex++===0)continue; // 첫 투수는 선발
      out.push({name,innings,pitches,battersFaced:0,date,consecutiveDays:1});
    }
  }
  return out;
}
function fatigue(latest:Line[],all:Line[]){
  const yesterdayPitches=latest.reduce((s,x)=>s+x.pitches,0),recent3DayPitches=all.reduce((s,x)=>s+x.pitches,0);
  const by=new Map<string,Set<string>>();for(const x of all){if(!by.has(x.name))by.set(x.name,new Set());by.get(x.name)!.add(x.date);}
  const consecutivePitchers=[...by.values()].filter(x=>x.size>=2).length,heavyPitchers=latest.filter(x=>x.pitches>=25||ip(x.innings)>=2).length;
  const score=Math.min(100,Math.round(yesterdayPitches*.7+(recent3DayPitches-yesterdayPitches)*.25+consecutivePitchers*15+heavyPitchers*12+(latest.length>=4?8:0)));
  return {score,label:score>=80?"매우 높음":score>=55?"높음":score>=30?"보통":"낮음",yesterdayPitches,recent3DayPitches,yesterdayBattersFaced:0,recent3DayBattersFaced:0,pitcherCount:latest.length,heavyPitchers,consecutivePitchers,workloadUnit:"NP"};
}
export async function GET(req:Request){
  try{
    const sp=new URL(req.url).searchParams,code=teamCode(sp.get("team")??""),target=sp.get("date")||ymd(new Date());
    if(!code)return NextResponse.json({success:false,status:"error",pitchers:[],fatigue:null,message:"올바른 팀명이 필요합니다."},{status:400});
    const dates=allowedDates(target);
    const scheduleSlug=TEAM_SCHEDULE[code];
    const schedules=await Promise.all([
      `${BASE}/schedule/${scheduleSlug}`,
      `${BASE}/schedule/${scheduleSlug}?date=${dates[0]}`,
      `${BASE}/schedule`
    ].map(u=>get(u).catch(()=>"")));
    const links=[...new Set(schedules.flatMap(h=>gameLinks(h,code,dates)))];
    const chunks:Line[]=[];
    for(const href of links){const dm=href.match(/(\d{8})$/);if(!dm)continue;const date=`${dm[1].slice(0,4)}-${dm[1].slice(4,6)}-${dm[1].slice(6,8)}`;try{chunks.push(...parseGame(await get(BASE+href),code,date));}catch{}}
    if(!chunks.length)return NextResponse.json({success:true,status:"unavailable",latestGameDate:null,pitchers:[],fatigue:null,message:"최근 3일 경기의 불펜 기록을 찾지 못했습니다.",diagnostics:{source:"MyKBO",links,allowed:dates}});
    const latestDate=[...new Set(chunks.map(x=>x.date))].sort().reverse()[0];
    const latest=chunks.filter(x=>x.date===latestDate);
    const by=new Map<string,Set<string>>();for(const x of chunks){if(!by.has(x.name))by.set(x.name,new Set());by.get(x.name)!.add(x.date);}for(const x of latest)x.consecutiveDays=by.get(x.name)?.size??1;
    return NextResponse.json({success:true,status:"received",latestGameDate:latestDate,pitchers:latest,recent3Days:[...new Set(chunks.map(x=>x.date))].sort().reverse().map(date=>({date,lines:chunks.filter(x=>x.date===date)})),fatigue:fatigue(latest,chunks),source:"MyKBO Stats",updatedAt:new Date().toISOString(),diagnostics:{links,parsed:chunks.length}});
  }catch(e){return NextResponse.json({success:false,status:"error",pitchers:[],fatigue:null,message:e instanceof Error?e.message:"불펜 기록 조회 실패"},{status:500});}
}

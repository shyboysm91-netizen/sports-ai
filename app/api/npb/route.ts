import { NextResponse } from "next/server";
import { playerNameKo } from "./_shared";

const TEAMS: Record<string,string> = {
  "Hanshin":"한신 타이거스","Yomiuri":"요미우리 자이언츠","DeNA":"요코하마 DeNA 베이스타스",
  "Chunichi":"주니치 드래건스","Hiroshima":"히로시마 도요 카프","Yakult":"도쿄 야쿠르트 스왈로스",
  "SoftBank":"후쿠오카 소프트뱅크 호크스","Nippon-Ham":"홋카이도 닛폰햄 파이터스","ORIX":"오릭스 버팔로스",
  "Rakuten":"도호쿠 라쿠텐 골든이글스","Seibu":"사이타마 세이부 라이온스","Lotte":"지바 롯데 마린스"
};

const STADIUMS=["Jingu","Tokyo Dome","Yokohama","Vantelin Dome","Mazda Stadium","Koshien","Mizuho PayPay","ES CON FIELD","Kyocera Dome","Rakuten Mobile","Belluna Dome","ZOZO Marine","Hotto Motto","Kurashiki","Matsuyama","Naha"];

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
    "Mizuho PayPay":"미즈호 PayPay 돔","ES CON FIELD":"에스콘 필드","Kyocera Dome":"교세라 돔",
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

export const revalidate=300;

export async function GET(req:Request){
 try{
  const date=new URL(req.url).searchParams.get("date")||new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const year=date.slice(0,4), compact=date.replaceAll("-","");
  const url=`https://npb.jp/bis/eng/${year}/games/gm${compact}.html`;
  const r=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0","Accept":"text/html"},next:{revalidate:300}});
  if(!r.ok) return NextResponse.json({success:true,games:[],message:"NPB 공식 일정이 아직 게시되지 않았습니다.",source:url});
  const html=await r.text();
  const text=clean(html);
  const names=Object.keys(TEAMS);
  const games:any[]=[];

  for(const stadium of STADIUMS){
   let from=0;
   while(true){
    const i=text.indexOf(stadium,from);
    if(i<0) break;
    const chunk=text.slice(Math.max(0,i-260),i+stadium.length+300);
    const left=text.slice(Math.max(0,i-140),i);
    const right=text.slice(i+stadium.length,i+stadium.length+140);
    const before=names.filter(n=>left.includes(n)).sort((a,b)=>left.lastIndexOf(b)-left.lastIndexOf(a))[0];
    const after=names.filter(n=>right.includes(n)).sort((a,b)=>right.indexOf(a)-right.indexOf(b))[0];
    const tm=(right.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/)||left.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/))?.[0]||"";

    if(before&&after&&before!==after&&!games.some(g=>g.awayApiName===before&&g.homeApiName===after)){
      const awayStarter=starterFromChunk(chunk,before);
      const homeStarter=starterFromChunk(chunk,after);
      games.push({
        league:"NPB",date,time:tm,away:TEAMS[before],home:TEAMS[after],
        stadium:jpStadium(stadium),
        awayStarter,homeStarter,
        awayStarterCode:"",homeStarterCode:"",
        awayApiName:before,homeApiName:after,
        starterStatus: awayStarter || homeStarter ? "official-page" : "not-announced",
      });
    }
    from=i+stadium.length;
   }
  }
  return NextResponse.json({success:true,games,source:url});
 }catch(e){
   return NextResponse.json({success:false,games:[],message:e instanceof Error?e.message:"NPB 일정 오류"},{status:500});
 }
}

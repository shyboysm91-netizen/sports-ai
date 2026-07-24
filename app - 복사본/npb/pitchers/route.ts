import { NextResponse } from "next/server";
import { findTeam, inningsToOuts, num, outsToInnings, playerNameKo, tableRows } from "../_shared";

type Pitcher = { name:string; originalName:string; games:number; wins:number; losses:number; saves:number; holds:number; inningsOuts:number; hits:number; homeRuns:number; walks:number; hitByPitch:number; strikeouts:number; runs:number; earnedRuns:number; era:number };

export async function GET(request:Request){
  const q=new URL(request.url).searchParams;
  const teamName=q.get("team")??"";
  const season=/^\d{4}$/.test(q.get("season")??"")?q.get("season")!:String(new Date().getFullYear());
  const team=findTeam(teamName);
  if(!team)return NextResponse.json({success:false,message:"NPB 팀을 찾지 못했습니다."},{status:400});

  try{
    const response=await fetch(`https://npb.jp/bis/eng/${season}/stats/idp1_${team.code}.html`,{headers:{"User-Agent":"Mozilla/5.0",Accept:"text/html"},cache:"no-store"});
    if(!response.ok)throw new Error(`NPB 투수 기록 요청 실패: ${response.status}`);
    const rows=tableRows(await response.text()), players:Pitcher[]=[];

    // 공식 열: Pitcher G W L SV HLD HP CG SHO NWG PCT BF IP H HR BB IBB HB SO WP BK R ER ERA
    for(const c of rows){
      if(c.length<24 || !/[A-Za-z]/.test(c[0]) || !/^\d+$/.test(c[1]??"")) continue;
      const originalName=c[0].replace(/^[*+]/,"").trim();
      players.push({
        name:playerNameKo(originalName), originalName,
        games:num(c[1]), wins:num(c[2]), losses:num(c[3]), saves:num(c[4]), holds:num(c[5]),
        inningsOuts:inningsToOuts(c[12]), hits:num(c[13]), homeRuns:num(c[14]), walks:num(c[15]),
        hitByPitch:num(c[17]), strikeouts:num(c[18]), runs:num(c[21]), earnedRuns:num(c[22]), era:num(c[23]),
      });
    }

    const withDerived=players.map(p=>{
      const innings=p.inningsOuts/3;
      return {...p, innings:outsToInnings(p.inningsOuts), whip:innings?(p.hits+p.walks)/innings:0, kPer9:innings?p.strikeouts*9/innings:0, bbPer9:innings?p.walks*9/innings:0};
    });
    const rotation=[...withDerived].filter(p=>p.inningsOuts>=30).sort((a,b)=>b.inningsOuts-a.inningsOuts).slice(0,6);
    const bullpen=[...withDerived].filter(p=>p.games>=8&&p.inningsOuts<Math.max(90,p.games*9)).sort((a,b)=>b.games-a.games).slice(0,8);
    const outs=players.reduce((s,p)=>s+p.inningsOuts,0), earned=players.reduce((s,p)=>s+p.earnedRuns,0), hits=players.reduce((s,p)=>s+p.hits,0), walks=players.reduce((s,p)=>s+p.walks,0);

    return NextResponse.json({
      success:true, source:"NPB 공식 팀별 선수 투수 기록", season, team:team.ko,
      teamPitching:{innings:outsToInnings(outs),era:outs?earned*27/outs:0,whip:outs?(hits+walks)*3/outs:0},
      rotation,bullpen,
    });
  }catch(error){
    return NextResponse.json({success:false,message:error instanceof Error?error.message:"NPB 투수 기록 오류"},{status:500});
  }
}

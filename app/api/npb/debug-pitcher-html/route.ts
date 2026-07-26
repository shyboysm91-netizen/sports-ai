import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
function text(v:string){return v.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();}
function cells(row:string){return [...row.matchAll(/<t[dh]\b[^>]*>[\s\S]*?<\/t[dh]>/gi)].map((m,i)=>({index:i,text:text(m[0]),html:m[0]}));}
function rows(table:string){return [...table.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)].map((m,i)=>({index:i,text:text(m[0]),cells:cells(m[0]),html:m[0]}));}
export async function GET(req:Request){
 const q=new URL(req.url).searchParams; const code=q.get("playerCode")||""; const url=q.get("url")||"";
 if(!/^\d+$/.test(code)||!/^https:\/\/npb\.jp\//.test(url)) return NextResponse.json({success:false,message:"playerCode와 NPB URL이 필요합니다."},{status:400});
 const r=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0","Accept-Language":"ja"},cache:"no-store"}); const html=await r.text();
 const tables=[...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map((m,i)=>({index:i,html:m[0],text:text(m[0]),rows:rows(m[0])}));
 const candidates=tables.filter(t=>t.html.includes(code));
 const pitching=candidates.filter(t=>/投手/.test(t.text)&&/(投球数|球数)/.test(t.text)&&/(投球回|回)/.test(t.text)&&/(自責点|自責)/.test(t.text));
 return NextResponse.json({success:true,debugVersion:"npb-html-debug-v2-pitching-only",playerCode:code,allMatchingTables:candidates.map(t=>({tableIndex:t.index,preview:t.text.slice(0,300)})),pitchingTableCount:pitching.length,pitchingTables:pitching.map(t=>({tableIndex:t.index,tableText:t.text,rows:t.rows.map(r=>({index:r.index,text:r.text,cells:r.cells.map(c=>({index:c.index,text:c.text,html:c.html}))}))}))},{headers:{"Cache-Control":"no-store"}});
}

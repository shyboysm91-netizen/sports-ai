import { NextRequest, NextResponse } from "next/server";
import { generateOneNewsArticle } from "@/app/lib/news-generator";
export const runtime="nodejs"; export const dynamic="force-dynamic"; export const maxDuration=300;
function authorized(request:NextRequest){const secret=process.env.CRON_SECRET;if(!secret)return false;return request.headers.get("authorization")===`Bearer ${secret}`||request.nextUrl.searchParams.get("secret")===secret;}
function koreaDate(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
function publishTime(date:string,hour:number){return new Date(`${date}T${String(hour).padStart(2,"0")}:00:00+09:00`).toISOString();}
async function run(request:NextRequest){if(!authorized(request))return NextResponse.json({success:false,message:"Cron 인증 실패"},{status:401});try{const date=koreaDate();const hours=[8,10,12,14,16,18,21];const results=[];for(const hour of hours){const result=await generateOneNewsArticle({status:"published",publishedAt:publishTime(date,hour)});results.push({hour,result});if(result.skipped&&/7개/.test(result.reason||""))break;}return NextResponse.json({success:true,date,created:results.filter(item=>!item.result.skipped).length,results});}catch(e){return NextResponse.json({success:false,message:e instanceof Error?e.message:"뉴스 자동 생성 실패"},{status:500});}}
export const GET=run; export const POST=run;

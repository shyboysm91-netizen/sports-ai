import { NextRequest, NextResponse } from "next/server";
import { listNews } from "@/app/lib/news-db";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest){ try{ const category=request.nextUrl.searchParams.get("category")||"전체"; const articles=await listNews({status:"published",category,limit:Number(request.nextUrl.searchParams.get("limit")||50)}); return NextResponse.json({success:true,articles}); }catch(e){ return NextResponse.json({success:false,message:e instanceof Error?e.message:"뉴스 조회 실패"},{status:500}); } }

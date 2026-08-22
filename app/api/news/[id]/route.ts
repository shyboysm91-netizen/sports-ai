import { NextRequest, NextResponse } from "next/server";
import { deleteNews, updateNews } from "@/app/lib/news-db";
import { newsAdminAuthorized } from "@/app/lib/news-auth";
export const dynamic="force-dynamic";
export async function PATCH(request:NextRequest,{params}:RouteContext<"/api/news/[id]">){ if(!newsAdminAuthorized(request))return NextResponse.json({success:false,message:"관리자 인증 실패"},{status:401}); try{ const {id}=await params; const article=await updateNews(id,await request.json()); return NextResponse.json({success:true,article}); }catch(e){return NextResponse.json({success:false,message:e instanceof Error?e.message:"수정 실패"},{status:500});}}
export async function DELETE(request:NextRequest,{params}:RouteContext<"/api/news/[id]">){ if(!newsAdminAuthorized(request))return NextResponse.json({success:false,message:"관리자 인증 실패"},{status:401}); try{ const {id}=await params; await deleteNews(id); return NextResponse.json({success:true}); }catch(e){return NextResponse.json({success:false,message:e instanceof Error?e.message:"삭제 실패"},{status:500});}}

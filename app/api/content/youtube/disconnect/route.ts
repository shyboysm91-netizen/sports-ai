import { NextResponse } from "next/server";
import { cookieName } from "@/app/lib/youtube-oauth";
export async function POST() { const res=NextResponse.json({success:true}); res.cookies.set(cookieName(),"",{path:"/",maxAge:0}); return res; }

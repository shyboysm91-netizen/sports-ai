import { NextRequest, NextResponse } from "next/server";
import { cookieName, encryptToken, getValidToken } from "@/app/lib/youtube-oauth";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  const token = await getValidToken(request);
  if (!token) return NextResponse.json({ success:false, message:"유튜브 계정을 먼저 연결하세요." }, { status:401 });
  const body = await request.json().catch(()=>({}));
  const title = String(body.title||"").trim().slice(0,100); const description = String(body.description||"").slice(0,5000);
  const privacyStatus = ["private","unlisted","public"].includes(body.privacyStatus) ? body.privacyStatus : "private";
  const mimeType = String(body.mimeType||"video/webm"); const size = Number(body.size||0);
  if (!title || !size) return NextResponse.json({ success:false, message:"영상 제목과 파일이 필요합니다." }, { status:400 });
  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", { method:"POST", headers:{ Authorization:`Bearer ${token.access_token}`, "Content-Type":"application/json; charset=UTF-8", "X-Upload-Content-Length":String(size), "X-Upload-Content-Type":mimeType }, body:JSON.stringify({ snippet:{ title, description, categoryId:"17" }, status:{ privacyStatus, selfDeclaredMadeForKids:false } }) });
  if (!init.ok) return NextResponse.json({ success:false, message:`유튜브 업로드 세션 생성 실패: ${await init.text()}` }, { status:init.status });
  const uploadUrl = init.headers.get("location");
  if (!uploadUrl) return NextResponse.json({ success:false, message:"유튜브 업로드 주소를 받지 못했습니다." }, { status:500 });
  const res = NextResponse.json({ success:true, uploadUrl });
  res.cookies.set(cookieName(), encryptToken(token), { httpOnly:true, secure:request.nextUrl.protocol==="https:", sameSite:"lax", path:"/", maxAge:60*60*24*180 });
  return res;
}

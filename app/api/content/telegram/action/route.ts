import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getValidToken } from "@/app/lib/youtube-oauth";
import { readApproval, updateApproval } from "@/app/lib/content-automation-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

type ApprovalPayload = {
  approvalId: string;
  league: string; date: string; away: string; home: string; title: string;
  platforms: string[]; exp: number;
};

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function page(title: string, message: string, ok: boolean) {
  const accent = ok ? "#22c55e" : "#ef4444";
  return new NextResponse(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="margin:0;background:#070b12;color:#fff;font-family:Arial,sans-serif"><main style="max-width:560px;margin:80px auto;padding:24px"><section style="border:1px solid #263244;background:#111827;border-radius:24px;padding:30px"><div style="font-size:44px">${ok ? "✅" : "❌"}</div><h1 style="margin:18px 0 12px;color:${accent}">${title}</h1><p style="line-height:1.7;color:#cbd5e1">${message}</p><a href="/content" style="display:block;margin-top:24px;padding:14px;text-align:center;border-radius:12px;background:#2563eb;color:#fff;text-decoration:none;font-weight:800">콘텐츠 제작 화면으로 돌아가기</a></section></main></body></html>`, { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

async function notify(text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return;
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  }).catch(() => undefined);
}

async function downloadTelegramFile(fileId: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error("텔레그램 봇 토큰이 없습니다.");
  const infoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`, { cache: "no-store" });
  const info = await infoResponse.json();
  if (!infoResponse.ok || !info?.ok || !info?.result?.file_path) throw new Error(info?.description || "텔레그램 영상 위치를 찾지 못했습니다.");
  const fileResponse = await fetch(`https://api.telegram.org/file/bot${botToken}/${info.result.file_path}`, { cache: "no-store" });
  if (!fileResponse.ok) throw new Error(`텔레그램 영상 다운로드 실패 (${fileResponse.status})`);
  return Buffer.from(await fileResponse.arrayBuffer());
}

async function uploadYoutube(buffer: Buffer, title: string, description: string, mimeType: string, privacyStatus: "private" | "unlisted" | "public") {
  const token = await getValidToken();
  if (!token) throw new Error("서버에 저장된 YouTube 연결 정보가 없습니다. 콘텐츠 화면에서 YouTube 계정을 한 번 다시 연결해 주세요.");
  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Length": String(buffer.length),
      "X-Upload-Content-Type": mimeType,
    },
    body: JSON.stringify({
      snippet: { title: title.slice(0, 100), description: description.slice(0, 5000), categoryId: "17" },
      status: { privacyStatus, selfDeclaredMadeForKids: false },
    }),
  });
  if (!init.ok) throw new Error(`YouTube 업로드 준비 실패: ${await init.text()}`);
  const uploadUrl = init.headers.get("location");
  if (!uploadUrl) throw new Error("YouTube 업로드 주소를 받지 못했습니다.");
  const upload = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": mimeType }, body: buffer });
  const result = await upload.json().catch(() => ({}));
  if (!upload.ok || !result?.id) throw new Error(`YouTube 업로드 실패: ${JSON.stringify(result)}`);
  return { videoId: String(result.id), url: `https://www.youtube.com/watch?v=${result.id}` };
}

export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get("action");
  const token = request.nextUrl.searchParams.get("token") || "";
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.CONTENT_APPROVAL_SECRET || botToken;
  if (!secret || !token.includes(".")) return page("승인 실패", "유효하지 않은 승인 링크입니다.", false);

  const [encoded, signature] = token.split(".");
  if (!encoded || !signature || !safeEqual(sign(encoded, secret), signature)) return page("승인 실패", "서명이 올바르지 않은 링크입니다.", false);

  let payload: ApprovalPayload;
  try { payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")); }
  catch { return page("승인 실패", "승인 정보를 읽지 못했습니다.", false); }
  if (!payload.exp || Date.now() > payload.exp) return page("승인 만료", "이 승인 링크는 24시간이 지나 만료되었습니다.", false);
  if (!payload.approvalId) return page("승인 실패", "approval_id가 없습니다.", false);

  const approval = await readApproval(payload.approvalId);
  if (!approval) return page("승인 실패", "저장된 승인 데이터를 찾지 못했습니다.", false);

  if (action === "cancel") {
    if (approval.status === "published") return page("취소 불가", "이미 YouTube에 업로드된 콘텐츠입니다.", false);
    await updateApproval(payload.approvalId, { status: "cancelled" });
    await notify(`❌ 발행 취소\n${approval.league} ${approval.title}\n${approval.date}`);
    return page("발행 취소 완료", `${approval.title} 콘텐츠 발행을 취소했습니다.`, false);
  }
  if (action !== "approve") return page("처리 실패", "지원하지 않는 작업입니다.", false);

  if (approval.status === "published" && approval.youtubeUrl) {
    return page("이미 업로드 완료", `${approval.title} 영상은 이미 YouTube에 업로드되었습니다.<br><br>${approval.youtubeUrl}`, true);
  }
  if (approval.status === "uploading") return page("업로드 진행 중", "이미 업로드가 시작되었습니다. 잠시 후 텔레그램 완료 메시지를 확인하세요.", true);
  if (approval.status === "cancelled") return page("승인 불가", "이미 취소된 발행 요청입니다.", false);
  if (!(approval.platforms || []).includes("youtube")) return page("승인 완료", "YouTube가 업로드 플랫폼으로 선택되지 않았습니다.", true);
  if (!approval.telegramFileId) return page("업로드 실패", "저장된 영상 파일 정보가 없습니다. 릴스를 포함해 다시 승인 요청을 보내세요.", false);

  await updateApproval(payload.approvalId, { status: "uploading", error: undefined });
  await notify(`⏳ YouTube Shorts 업로드 시작\n${approval.league} ${approval.title}`);

  try {
    const video = await downloadTelegramFile(approval.telegramFileId);
    const uploaded = await uploadYoutube(video, `${approval.title} Sports AI 분석`, approval.description, approval.mimeType || "video/webm", approval.privacyStatus || "private");
    await updateApproval(payload.approvalId, {
      status: "published",
      youtubeVideoId: uploaded.videoId,
      youtubeUrl: uploaded.url,
      error: undefined,
    });
    await notify(`✅ YouTube Shorts 업로드 완료\n${approval.league} ${approval.title}\n${uploaded.url}`);
    return page("YouTube 업로드 완료", `${approval.title} 영상이 YouTube에 등록되었습니다.<br><br>${uploaded.url}`, true);
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 업로드 오류";
    await updateApproval(payload.approvalId, { status: "failed", error: message });
    await notify(`❌ YouTube 업로드 실패\n${approval.league} ${approval.title}\n${message}`);
    return page("YouTube 업로드 실패", message, false);
  }
}

import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getValidToken } from "@/app/lib/youtube-oauth";
import { publishInstagramReel } from "@/app/lib/instagram-publisher";
import { publishTikTokVideo } from "@/app/lib/tiktok-publisher";
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

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char));
}

function page(title: string, message: string, ok: boolean) {
  const accent = ok ? "#22c55e" : "#ef4444";
  return new NextResponse(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head><body style="margin:0;background:#070b12;color:#fff;font-family:Arial,sans-serif"><main style="max-width:560px;margin:80px auto;padding:24px"><section style="border:1px solid #263244;background:#111827;border-radius:24px;padding:30px"><div style="font-size:44px">${ok ? "✅" : "❌"}</div><h1 style="margin:18px 0 12px;color:${accent}">${escapeHtml(title)}</h1><p style="line-height:1.7;color:#cbd5e1">${message}</p><a href="/content" style="display:block;margin-top:24px;padding:14px;text-align:center;border-radius:12px;background:#2563eb;color:#fff;text-decoration:none;font-weight:800">콘텐츠 제작 화면으로 돌아가기</a></section></main></body></html>`, { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
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
  const upload = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": mimeType }, body: new Uint8Array(buffer) });
  const result = await upload.json().catch(() => ({}));
  if (!upload.ok || !result?.id) throw new Error(`YouTube 업로드 실패: ${JSON.stringify(result)}`);
  return { videoId: String(result.id), url: `https://www.youtube.com/watch?v=${result.id}` };
}

function publicMediaUrl(request: NextRequest, approvalId: string, secret: string) {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin).replace(/\/$/, "");
  const exp = String(Date.now() + 30 * 60 * 1000);
  const sig = sign(`${approvalId}.${exp}`, secret);
  return `${siteUrl}/api/content/media/${encodeURIComponent(approvalId)}?exp=${encodeURIComponent(exp)}&sig=${encodeURIComponent(sig)}`;
}

function completedForPlatforms(approval: Awaited<ReturnType<typeof readApproval>>) {
  if (!approval) return false;
  const platforms = approval.platforms || [];
  const youtubeDone = !platforms.includes("youtube") || Boolean(approval.youtubeUrl);
  const instagramDone = !platforms.includes("instagram") || Boolean(approval.instagramMediaId);
  const tiktokDone = !platforms.includes("tiktok") || Boolean(approval.tiktokPublishId);
  return youtubeDone && instagramDone && tiktokDone;
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
    if (approval.status === "published") return page("취소 불가", "이미 업로드된 콘텐츠입니다.", false);
    await updateApproval(payload.approvalId, { status: "cancelled" });
    await notify(`❌ 발행 취소\n${approval.league} ${approval.title}\n${approval.date}`);
    return page("발행 취소 완료", `${escapeHtml(approval.title)} 콘텐츠 발행을 취소했습니다.`, false);
  }
  if (action !== "approve") return page("처리 실패", "지원하지 않는 작업입니다.", false);

  if (completedForPlatforms(approval)) {
    const links = [approval.youtubeUrl, approval.instagramUrl, approval.tiktokUrl].filter(Boolean).map((value) => escapeHtml(String(value))).join("<br>");
    return page("이미 업로드 완료", `${escapeHtml(approval.title)} 콘텐츠는 이미 업로드되었습니다.<br><br>${links}`, true);
  }
  if (approval.status === "uploading") return page("업로드 진행 중", "이미 업로드가 시작되었습니다. 잠시 후 텔레그램 완료 메시지를 확인하세요.", true);
  if (approval.status === "cancelled") return page("승인 불가", "이미 취소된 발행 요청입니다.", false);
  if (!approval.telegramFileId) return page("업로드 실패", "저장된 영상 파일 정보가 없습니다. 릴스를 포함해 다시 승인 요청을 보내세요.", false);

  const platforms = approval.platforms || [];
  const wantsYoutube = platforms.includes("youtube");
  const wantsInstagram = platforms.includes("instagram");
  const wantsTikTok = platforms.includes("tiktok");
  if (!wantsYoutube && !wantsInstagram && !wantsTikTok) return page("승인 완료", "자동 업로드가 가능한 플랫폼이 선택되지 않았습니다.", true);

  await updateApproval(payload.approvalId, { status: "uploading", error: undefined, instagramError: undefined, tiktokError: undefined });
  await notify(`⏳ 자동 업로드 시작\n${approval.league} ${approval.title}\n플랫폼: ${[wantsYoutube && "YouTube", wantsInstagram && "Instagram", wantsTikTok && "TikTok"].filter(Boolean).join(", ")}`);

  const successes: string[] = [];
  const failures: string[] = [];
  let video: Buffer | null = null;

  if (wantsYoutube && !approval.youtubeUrl) {
    try {
      video = video || await downloadTelegramFile(approval.telegramFileId);
      const uploaded = await uploadYoutube(video, `${approval.title} Sports AI 분석`, approval.description, approval.mimeType || "video/mp4", approval.privacyStatus || "public");
      await updateApproval(payload.approvalId, { youtubeVideoId: uploaded.videoId, youtubeUrl: uploaded.url });
      successes.push(`YouTube: ${uploaded.url}`);
    } catch (error) {
      failures.push(`YouTube: ${error instanceof Error ? error.message : "업로드 실패"}`);
    }
  } else if (wantsYoutube && approval.youtubeUrl) {
    successes.push(`YouTube: ${approval.youtubeUrl}`);
  }

  if (wantsInstagram && !approval.instagramMediaId) {
    try {
      const mimeType = (approval.mimeType || "").toLowerCase();
      const fileName = (approval.fileName || "").toLowerCase();
      if (!mimeType.includes("mp4") && !fileName.endsWith(".mp4") && !fileName.endsWith(".mov")) {
        throw new Error("Instagram은 MP4 또는 MOV 영상만 게시할 수 있습니다. 최신 버전에서 릴스를 새로 생성해 주세요.");
      }
      const mediaUrl = publicMediaUrl(request, payload.approvalId, secret);
      const caption = [approval.description, approval.hashtags].filter(Boolean).join("\n\n");
      const uploaded = await publishInstagramReel({ videoUrl: mediaUrl, caption });
      await updateApproval(payload.approvalId, { instagramMediaId: uploaded.mediaId, instagramUrl: uploaded.url, instagramError: undefined });
      successes.push(`Instagram: ${uploaded.url}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "업로드 실패";
      await updateApproval(payload.approvalId, { instagramError: message });
      failures.push(`Instagram: ${message}`);
    }
  } else if (wantsInstagram && approval.instagramMediaId) {
    successes.push(`Instagram: ${approval.instagramUrl || "게시 완료"}`);
  }

  if (wantsTikTok && !approval.tiktokPublishId) {
    try {
      const mimeType = (approval.mimeType || "").toLowerCase();
      const fileName = (approval.fileName || "").toLowerCase();
      if (!mimeType.includes("mp4") && !fileName.endsWith(".mp4")) {
        throw new Error("TikTok 자동 게시에는 MP4 영상이 필요합니다. 최신 버전에서 릴스를 새로 생성해 주세요.");
      }
      video = video || await downloadTelegramFile(approval.telegramFileId);
      const caption = [approval.description, approval.hashtags].filter(Boolean).join("\n\n");
      const uploaded = await publishTikTokVideo({ video, caption });
      await updateApproval(payload.approvalId, {
        tiktokPublishId: uploaded.publishId,
        tiktokPostId: uploaded.postId || undefined,
        tiktokUrl: uploaded.url || undefined,
        tiktokStatus: uploaded.status,
        tiktokError: undefined,
      });
      successes.push(`TikTok: ${uploaded.url || `게시 요청 완료 (${uploaded.status}, ${uploaded.privacyLevel})`}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "업로드 실패";
      await updateApproval(payload.approvalId, { tiktokError: message });
      failures.push(`TikTok: ${message}`);
    }
  } else if (wantsTikTok && approval.tiktokPublishId) {
    successes.push(`TikTok: ${approval.tiktokUrl || `게시 요청 완료 (${approval.tiktokStatus || "처리 완료"})`}`);
  }

  const finalStatus = failures.length ? "failed" : "published";
  const combinedError = failures.join("\n");
  await updateApproval(payload.approvalId, { status: finalStatus, error: combinedError || undefined });

  const resultText = [
    failures.length ? "⚠️ 자동 업로드 일부 실패" : "✅ 자동 업로드 완료",
    `${approval.league} ${approval.title}`,
    ...successes,
    ...failures.map((value) => `❌ ${value}`),
  ].join("\n");
  await notify(resultText);

  const html = [
    successes.length ? `<strong>완료</strong><br>${successes.map((value) => escapeHtml(value)).join("<br>")}` : "",
    failures.length ? `<br><br><strong>실패</strong><br>${failures.map((value) => escapeHtml(value)).join("<br>")}` : "",
  ].join("");
  return page(failures.length ? "자동 업로드 일부 실패" : "자동 업로드 완료", html, failures.length === 0);
}

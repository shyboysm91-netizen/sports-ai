import { createHmac, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { saveApproval, updateApproval } from "@/app/lib/content-automation-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Vercel 함수 요청 본문 제한보다 여유 있게 낮춥니다.
const SERVER_UPLOAD_LIMIT = 4 * 1024 * 1024;

type Payload = {
  league?: string;
  date?: string;
  away?: string;
  home?: string;
  caption?: string;
  title?: string;
  publishUrl?: string;
  platforms?: string[] | string;
  privacyStatus?: string;
};

function encode(value: object) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function cleanCaption(value: string, max = 950) {
  const trimmed = value.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

async function readRequest(request: NextRequest): Promise<{ body: Payload; media: File | null }> {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const raw = String(form.get("payload") || "{}");
    const mediaValue = form.get("media");
    return {
      body: JSON.parse(raw) as Payload,
      media: mediaValue instanceof File && mediaValue.size > 0 ? mediaValue : null,
    };
  }
  return { body: await request.json() as Payload, media: null };
}

async function telegramJson(botToken: string, method: string, body: object) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok || !result?.ok) throw new Error(result?.description || `텔레그램 ${method} 실패`);
  return result;
}

export async function POST(request: NextRequest) {
  let approvalId = "";
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!botToken || !chatId) {
      return NextResponse.json({ success: false, message: "TELEGRAM_BOT_TOKEN과 TELEGRAM_CHAT_ID를 환경변수에 넣어주세요." }, { status: 400 });
    }

    const { body, media } = await readRequest(request);
    if (!media) {
      return NextResponse.json({ success: false, message: "생성된 릴스 파일이 없습니다. 릴스를 다시 생성한 뒤 승인 요청을 보내세요." }, { status: 400 });
    }
    if (media.size > SERVER_UPLOAD_LIMIT) {
      return NextResponse.json({ success: false, message: `릴스 용량이 ${(media.size / 1024 / 1024).toFixed(1)}MB라 서버 전송 한도를 넘습니다. 새 버전에서 릴스를 다시 생성해 주세요.` }, { status: 413 });
    }

    const title = body.title || `${body.away || "원정팀"} vs ${body.home || "홈팀"}`;
    const platforms = Array.isArray(body.platforms)
      ? body.platforms
      : String(body.platforms || "").split(",").filter(Boolean);
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin).replace(/\/$/, "");
    const secret = process.env.CONTENT_APPROVAL_SECRET || botToken;
    approvalId = randomUUID();
    const payload = encode({
      approvalId,
      league: body.league || "-",
      date: body.date || "-",
      away: body.away || "원정팀",
      home: body.home || "홈팀",
      title,
      platforms,
      exp: Date.now() + 24 * 60 * 60 * 1000,
    });
    const token = `${payload}.${sign(payload, secret)}`;
    const approveUrl = `${siteUrl}/api/content/telegram/action?action=approve&token=${encodeURIComponent(token)}`;
    const cancelUrl = `${siteUrl}/api/content/telegram/action?action=cancel&token=${encodeURIComponent(token)}`;
    const editUrl = body.publishUrl || `${siteUrl}/content`;
    const keyboard = {
      inline_keyboard: [
        [{ text: "✅ 발행 승인", url: approveUrl }, { text: "❌ 취소", url: cancelUrl }],
        [{ text: "✏️ 내용 수정", url: editUrl }],
      ],
    };

    const summary = [
      "🎬 장군 AI 콘텐츠 발행 승인",
      "",
      `리그: ${body.league || "-"}`,
      `날짜: ${body.date || "-"}`,
      `경기: ${title}`,
      `플랫폼: ${platforms.length ? platforms.join(", ") : "선택 없음"}`,
      "",
      body.caption || "캡션 없음",
      "",
      "영상을 확인한 뒤 아래 버튼을 누르세요.",
    ].join("\n");

    const privacyStatus = ["private", "unlisted", "public"].includes(String(body.privacyStatus))
      ? body.privacyStatus as "private" | "unlisted" | "public"
      : "public";
    const now = new Date().toISOString();

    // 먼저 영상을 텔레그램에 올립니다. 이때는 승인 버튼을 붙이지 않습니다.
    const form = new FormData();
    form.set("chat_id", chatId);
    form.set("document", media, media.name || "sports-ai-reel.webm");
    form.set("caption", cleanCaption(summary));
    const videoResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, { method: "POST", body: form });
    const videoResult = await videoResponse.json();
    if (!videoResponse.ok || !videoResult?.ok) throw new Error(videoResult?.description || "텔레그램 영상 전송 실패");

    const telegramFileId = videoResult?.result?.document?.file_id || videoResult?.result?.video?.file_id || "";
    if (!telegramFileId) throw new Error("텔레그램 영상 file_id를 받지 못했습니다.");

    // 영상 file_id까지 포함한 완전한 승인 데이터를 저장합니다.
    const stored = await saveApproval({
      approvalId,
      league: body.league || "-",
      date: body.date || "-",
      away: body.away || "원정팀",
      home: body.home || "홈팀",
      title,
      description: body.caption || "",
      hashtags: (body.caption || "").split(/\s+/).filter((value) => value.startsWith("#")).join(" "),
      platforms,
      privacyStatus,
      status: "waiting",
      telegramFileId,
      fileName: media.name || "sports-ai-reel.webm",
      mimeType: media.type || "video/webm",
      createdAt: now,
      updatedAt: now,
    });
    if (!stored) throw new Error("영상 승인 데이터를 서버 DB에 저장하지 못했습니다. Supabase 연결 상태를 확인하세요.");

    // 저장이 끝난 뒤에만 승인 버튼을 별도 메시지로 전송합니다.
    await telegramJson(botToken, "sendMessage", {
      chat_id: chatId,
      text: `✅ 영상 저장 완료\n${body.league || "-"} ${title}\n발행 승인 또는 취소를 선택하세요.`,
      disable_web_page_preview: true,
      reply_markup: keyboard,
    });

    return NextResponse.json({
      success: true,
      approvalId,
      message: "릴스 영상과 발행 승인 버튼을 텔레그램으로 보냈습니다. 승인 링크는 24시간 동안 유효합니다.",
    });
  } catch (error) {
    if (approvalId) {
      await updateApproval(approvalId, {
        status: "failed",
        error: error instanceof Error ? error.message : "텔레그램 전송 실패",
      }).catch(() => false);
    }
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "텔레그램 전송 실패" }, { status: 500 });
  }
}

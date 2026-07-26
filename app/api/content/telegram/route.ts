import { createHmac } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { saveApproval, updateApproval } from "@/app/lib/content-automation-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TELEGRAM_FILE_LIMIT = 50 * 1024 * 1024;

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
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!botToken || !chatId) {
      return NextResponse.json({ success: false, message: "TELEGRAM_BOT_TOKEN과 TELEGRAM_CHAT_ID를 환경변수에 넣어주세요." }, { status: 400 });
    }

    const { body, media } = await readRequest(request);
    const title = body.title || `${body.away || "원정팀"} vs ${body.home || "홈팀"}`;
    const platforms = Array.isArray(body.platforms)
      ? body.platforms
      : String(body.platforms || "").split(",").filter(Boolean);
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin).replace(/\/$/, "");
    const secret = process.env.CONTENT_APPROVAL_SECRET || botToken;
    const approvalId = randomUUID();
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
      "🎬 Sports AI 콘텐츠 발행 승인",
      "",
      `리그: ${body.league || "-"}`,
      `날짜: ${body.date || "-"}`,
      `경기: ${title}`,
      `플랫폼: ${platforms.length ? platforms.join(", ") : "선택 없음"}`,
      "",
      body.caption || "캡션 없음",
      "",
      "내용을 확인한 뒤 발행 승인 또는 취소를 누르세요.",
    ].join("\n");

    if (media && media.size > TELEGRAM_FILE_LIMIT) {
      return NextResponse.json({ success: false, message: "텔레그램 미리보기 파일은 50MB 이하여야 합니다." }, { status: 413 });
    }

    const privacyStatus = ["private", "unlisted", "public"].includes(String(body.privacyStatus))
      ? body.privacyStatus as "private" | "unlisted" | "public"
      : "private";
    const now = new Date().toISOString();
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
      fileName: media?.name || undefined,
      mimeType: media?.type || undefined,
      createdAt: now,
      updatedAt: now,
    });
    if (!stored) throw new Error("승인 데이터를 서버 DB에 저장하지 못했습니다. Supabase 연결 상태를 확인하세요.");

    try {
      if (media) {
        const form = new FormData();
        form.set("chat_id", chatId);
        form.set("document", media, media.name || "sports-ai-reel.webm");
        form.set("caption", cleanCaption(summary));
        form.set("reply_markup", JSON.stringify(keyboard));
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, { method: "POST", body: form });
        const result = await response.json();
        if (!response.ok || !result?.ok) throw new Error(result?.description || "텔레그램 영상 전송 실패");
        const telegramFileId = result?.result?.document?.file_id || result?.result?.video?.file_id || "";
        if (!telegramFileId) throw new Error("텔레그램 영상 file_id를 받지 못했습니다.");
        const updated = await updateApproval(approvalId, {
          telegramFileId,
          fileName: media.name || "sports-ai-reel.webm",
          mimeType: media.type || "video/webm",
        });
        if (!updated) throw new Error("텔레그램 영상 정보를 승인 데이터에 저장하지 못했습니다.");
      } else {
        await telegramJson(botToken, "sendMessage", {
          chat_id: chatId,
          text: summary,
          disable_web_page_preview: true,
          reply_markup: keyboard,
        });
      }
    } catch (error) {
      await updateApproval(approvalId, {
        status: "failed",
        error: error instanceof Error ? error.message : "텔레그램 전송 실패",
      });
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: media
        ? "릴스 파일과 발행 승인 버튼을 텔레그램으로 보냈습니다. 승인 링크는 24시간 동안 유효합니다."
        : "발행 승인 요청을 텔레그램으로 보냈습니다. 릴스를 먼저 만들면 영상 파일도 함께 전송됩니다.",
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "텔레그램 전송 실패" }, { status: 500 });
  }
}

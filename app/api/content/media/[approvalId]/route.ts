import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { readApproval } from "@/app/lib/content-automation-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function approvalIdFrom(request: NextRequest) {
  const parts = request.nextUrl.pathname.split("/").filter(Boolean);
  return decodeURIComponent(parts[parts.length - 1] || "");
}

async function downloadTelegramFile(fileId: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error("텔레그램 봇 토큰이 없습니다.");
  const infoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`, { cache: "no-store" });
  const info = await infoResponse.json();
  if (!infoResponse.ok || !info?.ok || !info?.result?.file_path) throw new Error(info?.description || "영상 위치를 찾지 못했습니다.");
  const fileResponse = await fetch(`https://api.telegram.org/file/bot${botToken}/${info.result.file_path}`, { cache: "no-store" });
  if (!fileResponse.ok) throw new Error(`영상 다운로드 실패 (${fileResponse.status})`);
  return Buffer.from(await fileResponse.arrayBuffer());
}

async function prepare(request: NextRequest) {
  const approvalId = approvalIdFrom(request);
  const exp = request.nextUrl.searchParams.get("exp") || "";
  const signature = request.nextUrl.searchParams.get("sig") || "";
  const secret = process.env.CONTENT_APPROVAL_SECRET || process.env.TELEGRAM_BOT_TOKEN;
  if (!approvalId || !secret || !exp || !signature) throw new Error("유효하지 않은 영상 링크입니다.");
  if (Date.now() > Number(exp)) throw new Error("영상 링크가 만료되었습니다.");
  const signedValue = `${approvalId}.${exp}`;
  if (!safeEqual(sign(signedValue, secret), signature)) throw new Error("영상 링크 서명이 올바르지 않습니다.");
  const approval = await readApproval(approvalId);
  if (!approval?.telegramFileId) throw new Error("저장된 영상 정보가 없습니다.");
  return { approval, buffer: await downloadTelegramFile(approval.telegramFileId) };
}

function headersFor(size: number, mimeType: string, fileName: string) {
  return {
    "Content-Type": mimeType,
    "Content-Length": String(size),
    "Content-Disposition": `inline; filename="${fileName.replace(/[^a-zA-Z0-9._-]/g, "-")}"`,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=300",
  };
}

export async function HEAD(request: NextRequest) {
  try {
    const { approval, buffer } = await prepare(request);
    return new NextResponse(null, { status: 200, headers: headersFor(buffer.length, approval.mimeType || "video/mp4", approval.fileName || "sports-ai-reel.mp4") });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "영상 조회 실패" }, { status: 403 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { approval, buffer } = await prepare(request);
    const mimeType = approval.mimeType || "video/mp4";
    const fileName = approval.fileName || "sports-ai-reel.mp4";
    const range = request.headers.get("range");
    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range);
      const start = match?.[1] ? Number(match[1]) : 0;
      const end = match?.[2] ? Math.min(Number(match[2]), buffer.length - 1) : buffer.length - 1;
      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= buffer.length) {
        return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${buffer.length}` } });
      }
      const chunk = new Uint8Array(buffer.subarray(start, end + 1));
      return new NextResponse(chunk, {
        status: 206,
        headers: {
          ...headersFor(chunk.length, mimeType, fileName),
          "Content-Range": `bytes ${start}-${end}/${buffer.length}`,
        },
      });
    }
    return new NextResponse(new Uint8Array(buffer), { status: 200, headers: headersFor(buffer.length, mimeType, fileName) });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "영상 조회 실패" }, { status: 403 });
  }
}

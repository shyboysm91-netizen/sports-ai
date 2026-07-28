import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    return NextResponse.json({ success: false, message: "TELEGRAM_BOT_TOKEN과 TELEGRAM_CHAT_ID를 먼저 입력하세요." }, { status: 400 });
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "✅ 장군 AI 텔레그램 연결 테스트 성공\n\n이제 콘텐츠 관리자에서 ‘텔레그램으로 발행 승인 요청 보내기’를 사용할 수 있습니다.",
        disable_web_page_preview: true,
      }),
    });
    const json = await response.json();
    if (!response.ok || !json?.ok) throw new Error(json?.description || "테스트 메시지 전송 실패");
    return NextResponse.json({ success: true, message: "텔레그램으로 테스트 메시지를 보냈습니다." });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "테스트 메시지 전송 실패" }, { status: 500 });
  }
}

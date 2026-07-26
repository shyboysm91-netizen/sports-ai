import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";

  if (!botToken || !chatId) {
    return NextResponse.json({
      success: false,
      configured: false,
      bot: Boolean(botToken),
      chat: Boolean(chatId),
      siteUrl: Boolean(siteUrl),
      message: "TELEGRAM_BOT_TOKEN과 TELEGRAM_CHAT_ID가 필요합니다.",
    });
  }

  try {
    const [botResponse, chatResponse] = await Promise.all([
      fetch(`https://api.telegram.org/bot${botToken}/getMe`, { cache: "no-store" }),
      fetch(`https://api.telegram.org/bot${botToken}/getChat?chat_id=${encodeURIComponent(chatId)}`, { cache: "no-store" }),
    ]);
    const botJson = await botResponse.json();
    const chatJson = await chatResponse.json();

    if (!botResponse.ok || !botJson?.ok) {
      return NextResponse.json({ success: false, configured: true, message: botJson?.description || "봇 토큰을 확인하지 못했습니다." }, { status: 400 });
    }
    if (!chatResponse.ok || !chatJson?.ok) {
      return NextResponse.json({ success: false, configured: true, botName: botJson.result?.username || botJson.result?.first_name, message: chatJson?.description || "채팅 ID를 확인하지 못했습니다." }, { status: 400 });
    }

    const chat = chatJson.result || {};
    const chatName = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(" ") || String(chat.id);
    return NextResponse.json({
      success: true,
      configured: true,
      botName: botJson.result?.username ? `@${botJson.result.username}` : botJson.result?.first_name,
      chatName,
      siteUrl: Boolean(siteUrl),
      message: "텔레그램 봇과 채팅방 연결이 정상입니다.",
    });
  } catch (error) {
    return NextResponse.json({ success: false, configured: true, message: error instanceof Error ? error.message : "텔레그램 연결 확인 실패" }, { status: 500 });
  }
}

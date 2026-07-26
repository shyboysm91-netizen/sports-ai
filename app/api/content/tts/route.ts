import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) return NextResponse.json({ success: false, message: "GOOGLE_TTS_API_KEY가 필요합니다." }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const text = String(body.text || "").trim().slice(0, 4500);
  if (!text) return NextResponse.json({ success: false, message: "음성으로 만들 문장이 없습니다." }, { status: 400 });
  try {
    const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: "ko-KR", ssmlGender: "NEUTRAL" },
        audioConfig: { audioEncoding: "MP3", speakingRate: 1.08, pitch: 0 },
      }),
      cache: "no-store",
    });
    const json = await response.json();
    if (!response.ok || !json.audioContent) throw new Error(json?.error?.message || "Google TTS 음성 생성 실패");
    return NextResponse.json({ success: true, audioContent: json.audioContent });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "AI 음성 생성 실패" }, { status: 500 });
  }
}

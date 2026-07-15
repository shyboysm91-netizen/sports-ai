import { NextResponse } from "next/server";

type KboGame = {
  league: "KBO";
  date: string;
  time: string;
  away: string;
  home: string;
  stadium: string;
};

const TEAM_NAMES: Record<string, string> = {
  KIA: "KIA 타이거즈",
  SAMSUNG: "삼성 라이온즈",
  LG: "LG 트윈스",
  DOOSAN: "두산 베어스",
  KT: "KT 위즈",
  SSG: "SSG 랜더스",
  LOTTE: "롯데 자이언츠",
  HANWHA: "한화 이글스",
  NC: "NC 다이노스",
  KIWOOM: "키움 히어로즈",
};

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") ?? "2026-07-16";

    const month = date.slice(5, 7);

    const url =
      `https://eng.koreabaseball.com/Schedule/DailySchedule.aspx` +
      `?searchDate=${date}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "text/html",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`KBO 요청 실패: ${response.status}`);
    }

    const html = await response.text();
    const text = stripHtml(html);

    const day = date.slice(8, 10);
    const dateMarker = `${month}.${day}`;

    const startIndex = text.indexOf(dateMarker);

    if (startIndex === -1) {
      return NextResponse.json({
        success: true,
        date,
        count: 0,
        games: [],
        message: "해당 날짜의 경기 일정을 찾지 못했습니다.",
      });
    }

    const nextDatePattern = /\d{2}\.\d{2}\([A-Z]{3}\)/g;
    nextDatePattern.lastIndex = startIndex + dateMarker.length;

    const nextDateMatch = nextDatePattern.exec(text);
    const endIndex = nextDateMatch?.index ?? text.length;

    const dayText = text.slice(startIndex, endIndex);

    const teamCodes = Object.keys(TEAM_NAMES).join("|");
    const stadiumCodes =
      "JAMSIL|MUNHAK|SUWON|DAEGU|GWANGJU|SAJIK|CHANGWON|DAEJEON|GOCHEOKSKY";

    const gameRegex = new RegExp(
      `(\\d{2}:\\d{2})\\s+(${teamCodes})\\s+(?:\\d+\\s*:\\s*\\d+|:)\\s+(${teamCodes})[\\s\\S]*?(${stadiumCodes})`,
      "g",
    );

    const games: KboGame[] = [];
    const seen = new Set<string>();

    for (const match of dayText.matchAll(gameRegex)) {
      const [, time, awayCode, homeCode, stadium] = match;
      const key = `${time}-${awayCode}-${homeCode}`;

      if (seen.has(key)) continue;
      seen.add(key);

      games.push({
        league: "KBO",
        date,
        time,
        away: TEAM_NAMES[awayCode] ?? awayCode,
        home: TEAM_NAMES[homeCode] ?? homeCode,
        stadium,
      });
    }

    return NextResponse.json({
      success: true,
      source: "KBO official English schedule",
      date,
      count: games.length,
      games,
    });
  } catch (error) {
    console.error("KBO 일정 오류:", error);

    return NextResponse.json(
      {
        success: false,
        message: "KBO 경기 일정을 불러오지 못했습니다.",
        games: [],
      },
      { status: 500 },
    );
  }
}
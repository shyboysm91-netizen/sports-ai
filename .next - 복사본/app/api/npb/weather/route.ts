import { NextResponse } from "next/server";

const STADIUMS: Record<string, { lat: number; lon: number; dome?: boolean }> = {
  "메이지 진구": { lat: 35.6745, lon: 139.7170 },
  "도쿄 돔": { lat: 35.7056, lon: 139.7519, dome: true },
  "요코하마 스타디움": { lat: 35.4433, lon: 139.6401 },
  "반테린 돔": { lat: 35.1859, lon: 136.9474, dome: true },
  "마쓰다 스타디움": { lat: 34.3928, lon: 132.4842 },
  "한신 고시엔": { lat: 34.7213, lon: 135.3616 },
  "미즈호 PayPay 돔": { lat: 33.5953, lon: 130.3622, dome: true },
  "에스콘 필드": { lat: 42.9905, lon: 141.5491, dome: true },
  "교세라 돔": { lat: 34.6693, lon: 135.4760, dome: true },
  "라쿠텐 모바일 파크": { lat: 38.2561, lon: 140.9025 },
  "벨루나 돔": { lat: 35.7685, lon: 139.4205, dome: true },
  "ZOZO 마린": { lat: 35.6453, lon: 140.0309 },
};

function findStadium(name: string) {
  const found = Object.entries(STADIUMS).find(([key]) => name.includes(key) || key.includes(name));
  return found?.[1] ?? null;
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const stadiumName = q.get("stadium") ?? "";
  const date = q.get("date") ?? "";
  const stadium = findStadium(stadiumName);

  if (!stadium) {
    return NextResponse.json({ success: false, message: "구장 좌표 정보가 없습니다.", weather: null });
  }
  if (stadium.dome) {
    return NextResponse.json({
      success: true,
      weather: { dome: true, temperature: null, precipitation: null, windSpeed: null, windDirection: null, description: "돔구장 · 날씨 영향 적음" },
    });
  }

  try {
    const params = new URLSearchParams({
      latitude: String(stadium.lat),
      longitude: String(stadium.lon),
      hourly: "temperature_2m,precipitation_probability,wind_speed_10m,wind_direction_10m",
      timezone: "Asia/Tokyo",
      start_date: date,
      end_date: date,
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { next: { revalidate: 3600 } });
    if (!response.ok) throw new Error(`날씨 API 오류 (${response.status})`);
    const data = await response.json();
    const times: string[] = data.hourly?.time ?? [];
    const index = Math.max(0, times.findIndex((value) => value.endsWith("T18:00")));
    return NextResponse.json({
      success: true,
      weather: {
        dome: false,
        temperature: data.hourly?.temperature_2m?.[index] ?? null,
        precipitation: data.hourly?.precipitation_probability?.[index] ?? null,
        windSpeed: data.hourly?.wind_speed_10m?.[index] ?? null,
        windDirection: data.hourly?.wind_direction_10m?.[index] ?? null,
        description: "경기 시작 전후 예상",
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "날씨 오류", weather: null });
  }
}

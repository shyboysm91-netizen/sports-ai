import { NextRequest, NextResponse } from "next/server";

export const revalidate = 600;

type PitchSplit = {
  games: number;
  wins: number;
  losses: number;
  era: string;
  whip: string;
  innings: string;
};

type Coordinates = { latitude: number; longitude: number };

const emptySplit = (): PitchSplit => ({ games: 0, wins: 0, losses: 0, era: "-", whip: "-", innings: "-" });

function normalizeSplit(raw: any): PitchSplit {
  const stat = raw?.stat ?? raw ?? {};
  return {
    games: Number(stat.gamesPlayed ?? stat.gamesPitched ?? stat.gamesStarted ?? 0),
    wins: Number(stat.wins ?? 0),
    losses: Number(stat.losses ?? 0),
    era: String(stat.era ?? "-"),
    whip: String(stat.whip ?? "-"),
    innings: String(stat.inningsPitched ?? "-"),
  };
}

async function fetchJson(url: string) {
  const res = await fetch(url, { next: { revalidate: 600 }, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`외부 API ${res.status}`);
  return res.json();
}

async function pitcherSplit(playerId: number, season: string, sitCode?: "home" | "away", venueId?: number) {
  if (!playerId) return emptySplit();
  const qs = new URLSearchParams({ stats: venueId ? "byDateRange" : "season", group: "pitching", season });
  if (sitCode) qs.set("sitCodes", sitCode);
  if (venueId) {
    qs.set("startDate", `${season}-01-01`);
    qs.set("endDate", `${season}-12-31`);
    qs.set("venueIds", String(venueId));
  }
  try {
    const data = await fetchJson(`https://statsapi.mlb.com/api/v1/people/${playerId}/stats?${qs.toString()}`);
    const split = data?.stats?.[0]?.splits?.[0];
    return split ? normalizeSplit(split) : emptySplit();
  } catch {
    return emptySplit();
  }
}

function weatherLabel(code: number | null) {
  if (code == null) return "정보 없음";
  if (code === 0) return "맑음";
  if ([1, 2].includes(code)) return "대체로 맑음";
  if (code === 3) return "흐림";
  if ([45, 48].includes(code)) return "안개";
  if ([51, 53, 55, 56, 57].includes(code)) return "이슬비";
  if ([61, 63, 65, 66, 67].includes(code)) return "비";
  if ([71, 73, 75, 77].includes(code)) return "눈";
  if ([80, 81, 82].includes(code)) return "소나기";
  if ([85, 86].includes(code)) return "눈 소나기";
  if ([95, 96, 99].includes(code)) return "뇌우";
  return "변화 가능";
}

function compass(deg: number | null) {
  if (deg == null || !Number.isFinite(deg)) return "";
  const labels = ["북", "북동", "동", "남동", "남", "남서", "서", "북서"];
  return labels[Math.round(deg / 45) % 8];
}

function weatherImpact(tempC: number | null, windKmh: number | null, rain: number | null, indoor: boolean) {
  if (indoor) return "실내 경기로 날씨 영향 제한";
  const notes: string[] = [];
  if ((rain ?? 0) >= 60) notes.push("우천 지연 가능");
  else if ((rain ?? 0) >= 30) notes.push("비 가능성 있음");
  if ((windKmh ?? 0) >= 25) notes.push("강풍으로 타구 영향 큼");
  else if ((windKmh ?? 0) >= 15) notes.push("바람 영향 가능");
  if ((tempC ?? 20) >= 30) notes.push("고온으로 타구 비거리 소폭 증가 가능");
  if ((tempC ?? 20) <= 8) notes.push("저온으로 타구 비거리 감소 가능");
  return notes.length ? notes.join(" · ") : "경기 영향 크지 않음";
}

function readCoordinates(...sources: any[]): Coordinates | null {
  for (const source of sources) {
    const c = source?.location?.defaultCoordinates ?? source?.defaultCoordinates ?? source?.location ?? source;
    const latitude = Number(c?.latitude ?? c?.lat);
    const longitude = Number(c?.longitude ?? c?.lon ?? c?.lng);
    if (Number.isFinite(latitude) && Number.isFinite(longitude) && latitude !== 0 && longitude !== 0) {
      return { latitude, longitude };
    }
  }
  return null;
}

function isIndoorVenue(name: string, venue: any) {
  const roof = String(venue?.roofType ?? venue?.roof ?? venue?.fieldInfo?.roofType ?? "").toLowerCase();
  if (roof.includes("dome") || roof.includes("indoor") || roof.includes("fixed")) return true;
  const indoorNames = ["tropicana field"];
  return indoorNames.some((v) => name.toLowerCase().includes(v));
}

async function fetchForecast(coords: Coordinates, gameDateIso: string, date: string) {
  const params = new URLSearchParams({
    latitude: String(coords.latitude),
    longitude: String(coords.longitude),
    hourly: "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m",
    timezone: "auto",
    wind_speed_unit: "kmh",
    start_date: date,
    end_date: date,
  });
  const data = await fetchJson(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  const times: string[] = data?.hourly?.time ?? [];
  if (!times.length) return null;

  const target = new Date(gameDateIso).getTime();
  let index = 0;
  let best = Number.POSITIVE_INFINITY;
  times.forEach((time, i) => {
    const value = new Date(time).getTime();
    const diff = Number.isFinite(target) ? Math.abs(value - target) : i;
    if (diff < best) {
      best = diff;
      index = i;
    }
  });

  const at = (key: string) => data?.hourly?.[key]?.[index] ?? null;
  return {
    forecastTime: times[index] ?? null,
    tempC: Number(at("temperature_2m")),
    feelsLikeC: Number(at("apparent_temperature")),
    humidity: Number(at("relative_humidity_2m")),
    precipitationProbability: Number(at("precipitation_probability")),
    weatherCode: Number(at("weather_code")),
    windKmh: Number(at("wind_speed_10m")),
    windDirection: Number(at("wind_direction_10m")),
  };
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const date = q.get("date") ?? "";
  const season = date.slice(0, 4) || String(new Date().getFullYear());
  const awayTeamId = Number(q.get("awayTeamId") ?? 0);
  const homeTeamId = Number(q.get("homeTeamId") ?? 0);
  const awayStarterId = Number(q.get("awayStarterId") ?? 0);
  const homeStarterId = Number(q.get("homeStarterId") ?? 0);

  if (!date || (!awayTeamId && !homeTeamId)) {
    return NextResponse.json({ success: false, message: "경기 날짜 또는 팀 ID가 없습니다." }, { status: 400 });
  }

  try {
    const schedule = await fetchJson(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${encodeURIComponent(date)}&hydrate=venue,officials,probablePitcher,weather`
    );
    const games = (schedule?.dates ?? []).flatMap((d: any) => d.games ?? []);
    const game = games.find((g: any) => {
      const a = Number(g?.teams?.away?.team?.id ?? 0);
      const h = Number(g?.teams?.home?.team?.id ?? 0);
      return (!awayTeamId || a === awayTeamId) && (!homeTeamId || h === homeTeamId);
    });

    if (!game?.gamePk) {
      return NextResponse.json({ success: false, message: "해당 날짜의 MLB 경기를 찾지 못했습니다." });
    }

    let feed: any = null;
    try { feed = await fetchJson(`https://statsapi.mlb.com/api/v1.1/game/${game.gamePk}/feed/live`); } catch {}

    const venueId = Number(game?.venue?.id ?? feed?.gameData?.venue?.id ?? 0);
    const venueName = game?.venue?.name ?? feed?.gameData?.venue?.name ?? "경기장 미정";

    let venueDetail: any = null;
    if (venueId) {
      try {
        const venueData = await fetchJson(`https://statsapi.mlb.com/api/v1/venues/${venueId}?hydrate=location,fieldInfo`);
        venueDetail = venueData?.venues?.[0] ?? null;
      } catch {}
    }

    const coordinates = readCoordinates(feed?.gameData?.venue, venueDetail, game?.venue);
    const indoor = isIndoorVenue(venueName, venueDetail ?? feed?.gameData?.venue);
    const gameDateIso = game?.gameDate ?? feed?.gameData?.datetime?.dateTime ?? `${date}T19:00:00`;

    let forecast: any = null;
    if (coordinates && !indoor) {
      try { forecast = await fetchForecast(coordinates, gameDateIso, date); } catch {}
    }

    const feedWeather = feed?.gameData?.weather ?? game?.weather ?? {};
    const tempC = forecast && Number.isFinite(forecast.tempC) ? forecast.tempC : null;
    const tempF = tempC != null ? Math.round((tempC * 9) / 5 + 32) : (feedWeather?.temp ?? null);
    const windText = forecast && Number.isFinite(forecast.windKmh)
      ? `${compass(forecast.windDirection)}풍 ${Math.round(forecast.windKmh)}km/h`
      : String(feedWeather?.wind ?? "정보 없음");
    const condition = indoor ? "실내 경기" : forecast ? weatherLabel(forecast.weatherCode) : (feedWeather?.condition ?? "정보 없음");

    const officials = feed?.liveData?.boxscore?.officials ?? game?.officials ?? [];
    const homePlate = officials.find((o: any) => {
      const type = String(o?.officialType ?? o?.officialType?.displayName ?? "").toLowerCase();
      return type.includes("home plate") || type.includes("homeplate");
    });
    const umpireName = homePlate?.official?.fullName ?? homePlate?.official?.name ?? null;

    const [awayHome, awayRoad, awayVenue, homeHome, homeRoad, homeVenue] = await Promise.all([
      pitcherSplit(awayStarterId, season, "home"),
      pitcherSplit(awayStarterId, season, "away"),
      pitcherSplit(awayStarterId, season, undefined, venueId),
      pitcherSplit(homeStarterId, season, "home"),
      pitcherSplit(homeStarterId, season, "away"),
      pitcherSplit(homeStarterId, season, undefined, venueId),
    ]);

    return NextResponse.json({
      success: true,
      gamePk: game.gamePk,
      venue: { id: venueId, name: venueName, indoor, coordinates },
      weather: {
        condition,
        tempF,
        tempC,
        feelsLikeC: forecast?.feelsLikeC ?? null,
        humidity: forecast?.humidity ?? null,
        precipitationProbability: forecast?.precipitationProbability ?? null,
        wind: windText,
        windKmh: forecast?.windKmh ?? null,
        windDirection: forecast?.windDirection ?? null,
        forecastTime: forecast?.forecastTime ?? null,
        windEffect: weatherImpact(tempC, forecast?.windKmh ?? null, forecast?.precipitationProbability ?? null, indoor),
        source: forecast ? "Open-Meteo 경기시간 예보" : indoor ? "MLB 경기장 정보" : "MLB 경기 피드",
      },
      umpire: {
        name: umpireName,
        status: umpireName ? "확정" : "경기 직전 공개 예정",
      },
      pitchers: {
        away: { home: awayHome, away: awayRoad, venue: awayVenue },
        home: { home: homeHome, away: homeRoad, venue: homeVenue },
      },
      note: "날씨는 경기장 좌표와 경기 시작시간 기준 예보입니다. 주심은 MLB 경기 피드에 배정이 공개되는 즉시 표시됩니다.",
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "경기 환경 정보를 불러오지 못했습니다." });
  }
}

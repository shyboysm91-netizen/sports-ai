import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: "no-store", headers: { Accept: "application/json", "User-Agent": "Sports-AI/3.1" } });
  if (!res.ok) throw new Error(`외부 API ${res.status}`);
  return res.json();
}

function outsFromInnings(value: unknown) {
  const [whole, decimal] = String(value ?? "0").split(".");
  return Number(whole || 0) * 3 + Number(decimal || 0);
}

function aggregatePitchRows(rows: any[]): PitchSplit {
  if (!rows.length) return emptySplit();
  let outs=0,wins=0,losses=0,earnedRuns=0,hits=0,walks=0;
  for(const row of rows){
    const stat=row?.stat ?? {};
    outs+=outsFromInnings(stat.inningsPitched);
    wins+=Number(stat.wins ?? 0); losses+=Number(stat.losses ?? 0);
    earnedRuns+=Number(stat.earnedRuns ?? 0); hits+=Number(stat.hits ?? 0); walks+=Number(stat.baseOnBalls ?? 0);
  }
  const ip=outs/3;
  return {games:rows.length,wins,losses,era:ip?(earnedRuns*9/ip).toFixed(2):"-",whip:ip?((hits+walks)/ip).toFixed(2):"-",innings:`${Math.floor(outs/3)}.${outs%3}`};
}

async function pitcherSplits(playerId:number,teamId:number,season:string,venueId:number,endDate:string){
  if(!playerId) return {home:emptySplit(),away:emptySplit(),venue:emptySplit()};
  try{
    const data=await fetchJson(`https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=gameLog&group=pitching&season=${season}`);
    const rows=data?.stats?.find((x:any)=>x?.type?.displayName==="gameLog")?.splits ?? [];

    // MLB gameLog의 isHome은 응답에 따라 boolean 또는 문자열로 내려올 수 있다.
    // 이전 코드는 boolean만 인정해 분류가 실패했고, 화면에서 시즌 전체값이 대체값으로 반복됐다.
    const readHomeFlag=(value:any):boolean|undefined=>{
      if(value===true||value===1||value==="1") return true;
      if(value===false||value===0||value==="0") return false;
      const normalized=String(value??"").trim().toLowerCase();
      if(normalized==="true"||normalized==="home"||normalized==="h") return true;
      if(normalized==="false"||normalized==="away"||normalized==="a") return false;
      return undefined;
    };

    const scheduleCache=new Map<string,any[]>();
    const resolveGame=async(row:any)=>{
      const rowDate=String(row?.date??"").slice(0,10);
      if(!rowDate) return null;
      if(!scheduleCache.has(rowDate)){
        try{
          const schedule=await fetchJson(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${encodeURIComponent(rowDate)}&hydrate=team,venue`);
          scheduleCache.set(rowDate,(schedule?.dates??[]).flatMap((d:any)=>d?.games??[]));
        }catch{ scheduleCache.set(rowDate,[]); }
      }
      const games=scheduleCache.get(rowDate)??[];
      const gamePk=Number(row?.game?.gamePk??row?.gamePk??0);
      const opponentId=Number(row?.opponent?.id??0);
      return games.find((g:any)=>{
        if(gamePk&&Number(g?.gamePk??0)===gamePk) return true;
        const h=Number(g?.teams?.home?.team?.id??0);
        const a=Number(g?.teams?.away?.team?.id??0);
        if(teamId&&(h===teamId||a===teamId)&&(!opponentId||h===opponentId||a===opponentId)) return true;
        return false;
      })??null;
    };

    const enriched=await Promise.all(rows.map(async(row:any)=>{
      let isHome=readHomeFlag(row?.isHome);
      let matchedVenueId=Number(row?.venue?.id??row?.game?.venue?.id??0);

      // gameLog 자체 정보가 없을 때만 해당 경기의 공식 일정으로 보완한다.
      if(isHome===undefined||!matchedVenueId){
        const game=await resolveGame(row);
        if(game){
          const homeId=Number(game?.teams?.home?.team?.id??0);
          const awayId=Number(game?.teams?.away?.team?.id??0);
          const opponentId=Number(row?.opponent?.id??0);
          if(isHome===undefined){
            if(teamId&&homeId===teamId) isHome=true;
            else if(teamId&&awayId===teamId) isHome=false;
            else if(opponentId&&awayId===opponentId) isHome=true;
            else if(opponentId&&homeId===opponentId) isHome=false;
          }
          if(!matchedVenueId) matchedVenueId=Number(game?.venue?.id??0);
        }
      }
      return {...row,isHome,matchedVenueId};
    }));

    const homeRows=enriched.filter((x:any)=>x?.isHome===true);
    const awayRows=enriched.filter((x:any)=>x?.isHome===false);
    const venueRows=enriched.filter((x:any)=>venueId>0&&Number(x?.matchedVenueId??0)===venueId);

    return {
      home:aggregatePitchRows(homeRows),
      away:aggregatePitchRows(awayRows),
      venue:aggregatePitchRows(venueRows),
    };
  }catch{
    return {home:emptySplit(),away:emptySplit(),venue:emptySplit()};
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
  const requestedGamePk = Number(q.get("gamePk") ?? 0);
  const awayStarterIdParam = Number(q.get("awayStarterId") ?? 0);
  const homeStarterIdParam = Number(q.get("homeStarterId") ?? 0);

  if (!date || (!awayTeamId && !homeTeamId)) {
    return NextResponse.json({ success: false, message: "경기 날짜 또는 팀 ID가 없습니다." }, { status: 400 });
  }

  try {
    // 분석 페이지는 한국시간 날짜를 사용하지만 MLB 일정 API는 미국 현지 날짜 기준이라
    // 하루 차이가 날 수 있다. URL의 gamePk를 최우선으로 사용하고, 없으면 전후 하루까지 찾는다.
    let game: any = null;
    let feed: any = null;

    if (requestedGamePk) {
      try {
        feed = await fetchJson(`https://statsapi.mlb.com/api/v1.1/game/${requestedGamePk}/feed/live`);
        const feedAwayId = Number(feed?.gameData?.teams?.away?.id ?? 0);
        const feedHomeId = Number(feed?.gameData?.teams?.home?.id ?? 0);
        game = {
          gamePk: requestedGamePk,
          gameDate: feed?.gameData?.datetime?.dateTime ?? null,
          venue: feed?.gameData?.venue ?? null,
          weather: feed?.gameData?.weather ?? null,
          teams: {
            away: { team: { id: feedAwayId }, probablePitcher: feed?.gameData?.probablePitchers?.away ?? null },
            home: { team: { id: feedHomeId }, probablePitcher: feed?.gameData?.probablePitchers?.home ?? null },
          },
        };
      } catch {}
    }

    if (!game?.gamePk) {
      const base = new Date(`${date}T12:00:00Z`);
      const candidateDates = [-1, 0, 1].map((offset) => {
        const d = new Date(base);
        d.setUTCDate(d.getUTCDate() + offset);
        return d.toISOString().slice(0, 10);
      });

      for (const scheduleDate of candidateDates) {
        try {
          const schedule = await fetchJson(
            `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${encodeURIComponent(scheduleDate)}&hydrate=venue,officials,probablePitcher,weather`
          );
          const games = (schedule?.dates ?? []).flatMap((d: any) => d.games ?? []);
          game = games.find((g: any) => {
            const a = Number(g?.teams?.away?.team?.id ?? 0);
            const h = Number(g?.teams?.home?.team?.id ?? 0);
            return (!awayTeamId || a === awayTeamId) && (!homeTeamId || h === homeTeamId);
          }) ?? null;
          if (game?.gamePk) break;
        } catch {}
      }
    }

    if (!game?.gamePk) {
      return NextResponse.json({ success: false, message: "해당 경기의 MLB 공식 경기 정보를 찾지 못했습니다." });
    }

    if (!feed) {
      try { feed = await fetchJson(`https://statsapi.mlb.com/api/v1.1/game/${game.gamePk}/feed/live`); } catch {}
    }

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

    const awayStarterId = awayStarterIdParam || Number(
      game?.teams?.away?.probablePitcher?.id ?? feed?.gameData?.probablePitchers?.away?.id ?? 0
    );
    const homeStarterId = homeStarterIdParam || Number(
      game?.teams?.home?.probablePitcher?.id ?? feed?.gameData?.probablePitchers?.home?.id ?? 0
    );

    const [awaySplits, homeSplits] = await Promise.all([
      pitcherSplits(awayStarterId, awayTeamId, season, venueId, date),
      pitcherSplits(homeStarterId, homeTeamId, season, venueId, date),
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
        away: awaySplits,
        home: homeSplits,
      },
      note: "날씨는 경기장 좌표와 경기 시작시간 기준 예보입니다. 주심은 MLB 경기 피드에 배정이 공개되는 즉시 표시됩니다.",
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "경기 환경 정보를 불러오지 못했습니다." });
  }
}

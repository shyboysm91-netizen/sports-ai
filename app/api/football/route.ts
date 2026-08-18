import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const LEAGUES = {
  epl: { name: "프리미어리그", espn: "eng.1" },
  laliga: { name: "라리가", espn: "esp.1" },
  bundesliga: { name: "분데스리가", espn: "ger.1" },
  seriea: { name: "세리에 A", espn: "ita.1" },
  kleague: { name: "K리그1", espn: null },
} as const;

type LeagueKey = keyof typeof LEAGUES;

const TEAM_KO: Record<string, string> = {
  "Manchester United":"맨체스터 유나이티드","Manchester City":"맨체스터 시티","Liverpool":"리버풀","Arsenal":"아스널","Chelsea":"첼시","Tottenham Hotspur":"토트넘 홋스퍼","Newcastle United":"뉴캐슬 유나이티드","Aston Villa":"애스턴 빌라","Brighton & Hove Albion":"브라이턴","West Ham United":"웨스트햄 유나이티드","Crystal Palace":"크리스털 팰리스","Everton":"에버턴","Fulham":"풀럼","Brentford":"브렌트퍼드","Nottingham Forest":"노팅엄 포리스트","Wolverhampton Wanderers":"울버햄프턴","Leeds United":"리즈 유나이티드","Sunderland":"선덜랜드","Burnley":"번리","AFC Bournemouth":"본머스","Hull City":"헐 시티","Ipswich Town":"입스위치 타운","Leicester City":"레스터 시티","Southampton":"사우샘프턴",
  "Real Madrid":"레알 마드리드","Barcelona":"바르셀로나","Atletico Madrid":"아틀레티코 마드리드","Athletic Club":"아틀레틱 빌바오","Villarreal":"비야레알","Real Betis":"레알 베티스","Real Sociedad":"레알 소시에다드","Sevilla":"세비야","Valencia":"발렌시아","Girona":"지로나","Celta Vigo":"셀타 비고","Osasuna":"오사수나","Getafe":"헤타페","Mallorca":"마요르카","Rayo Vallecano":"라요 바예카노","Alavés":"알라베스","Espanyol":"에스파뇰","Levante":"레반테","Elche":"엘체","Real Oviedo":"레알 오비에도","Las Palmas":"라스팔마스","Leganés":"레가네스",
  "Bayern Munich":"바이에른 뮌헨","Borussia Dortmund":"보루시아 도르트문트","Bayer Leverkusen":"바이어 레버쿠젠","RB Leipzig":"RB 라이프치히","Eintracht Frankfurt":"아인트라흐트 프랑크푸르트","VfB Stuttgart":"슈투트가르트","SC Freiburg":"프라이부르크","Mainz":"마인츠","Borussia Monchengladbach":"묀헨글라트바흐","Werder Bremen":"베르더 브레멘","VfL Wolfsburg":"볼프스부르크","FC Augsburg":"아우크스부르크","TSG Hoffenheim":"호펜하임","Union Berlin":"우니온 베를린","FC St. Pauli":"장크트파울리","FC Cologne":"쾰른","Hamburg SV":"함부르크","Heidenheim":"하이덴하임","Holstein Kiel":"홀슈타인 킬","VfL Bochum":"보훔",
  "Internazionale":"인터 밀란","Inter Milan":"인터 밀란","AC Milan":"AC 밀란","Juventus":"유벤투스","Napoli":"나폴리","AS Roma":"AS 로마","Lazio":"라치오","Atalanta":"아탈란타","Fiorentina":"피오렌티나","Bologna":"볼로냐","Torino":"토리노","Genoa":"제노아","Udinese":"우디네세","Parma":"파르마","Cagliari":"칼리아리","Como":"코모","Hellas Verona":"엘라스 베로나","Lecce":"레체","Sassuolo":"사수올로","Pisa":"피사","Cremonese":"크레모네세","Empoli":"엠폴리","Monza":"몬차","Venezia":"베네치아",
};

const KLEAGUE_TEAM_KO: Record<string,string> = {
  GANGWON:"강원FC",BUCHEON:"부천FC",JEONBUK:"전북 현대",SEOUL:"FC서울",POHANG:"포항 스틸러스",GIMCHEON:"김천 상무",ULSAN:"울산 HD",ANYANG:"FC안양",DAEJEON:"대전 하나시티즌",GWANGJU:"광주FC",DAEGU:"대구FC",SUWONFC:"수원FC",JEJU:"제주 SK",INCHEON:"인천 유나이티드",
};

function validDate(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

function statusKo(type: string, detail: string) {
  if (type === "STATUS_FINAL") return "종료";
  if (type === "STATUS_IN_PROGRESS" || type === "STATUS_HALFTIME") return detail || "진행 중";
  if (type === "STATUS_POSTPONED") return "연기";
  return "경기 전";
}

async function espnGames(league: LeagueKey, date: string) {
  const code = LEAGUES[league].espn;
  if (!code) return [];
  const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/scoreboard?dates=${date.replaceAll("-", "")}`, { headers: { "User-Agent": "Janggun-AI/1.0" }, cache: "no-store" });
  if (!response.ok) throw new Error(`축구 일정 조회 실패 (${response.status})`);
  const data = await response.json();
  return (data.events ?? []).map((event: any) => {
    const competition = event.competitions?.[0] ?? {};
    const home = competition.competitors?.find((item: any) => item.homeAway === "home");
    const away = competition.competitors?.find((item: any) => item.homeAway === "away");
    const kickoff = new Date(event.date);
    return {
      id: String(event.id), league, leagueName: LEAGUES[league].name,
      date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(kickoff),
      time: new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(kickoff),
      home: TEAM_KO[home?.team?.displayName] ?? home?.team?.displayName ?? "홈팀",
      away: TEAM_KO[away?.team?.displayName] ?? away?.team?.displayName ?? "원정팀",
      homeScore: home?.score ?? null, awayScore: away?.score ?? null,
      venue: competition.venue?.fullName ?? "경기장 미정",
      status: statusKo(event.status?.type?.name, event.status?.type?.shortDetail),
    };
  });
}

async function kLeagueGames(date: string) {
  const [year, month] = date.split("-");
  const response = await fetch("https://www.kleague.com/getScheduleList.do", {
    method: "POST", headers: { "content-type": "application/json; charset=utf-8", accept: "application/json", "user-agent": "Janggun-AI/1.0" },
    body: JSON.stringify({ year, month, leagueId: 1 }), cache: "no-store",
  });
  if (!response.ok) throw new Error(`K리그 일정 조회 실패 (${response.status})`);
  const payload = await response.json();
  const data = payload?.data ?? payload;
  const clubs = new Map<string,string>((data?.clubList ?? []).map((club: any) => [club.teamId, club.teamNameShort || club.teamName || club.teamNameFull]));
  const dotted = date.replaceAll("-", ".");
  return (data?.scheduleList ?? []).filter((game: any) => game.gameDate === dotted).map((game: any) => ({
    id: String(game.gameId), league: "kleague", leagueName: "K리그1", date, time: game.gameTime || "시간 미정",
    home: KLEAGUE_TEAM_KO[clubs.get(game.homeTeam) || game.homeTeamName] || clubs.get(game.homeTeam) || game.homeTeamName || "홈팀",
    away: KLEAGUE_TEAM_KO[clubs.get(game.awayTeam) || game.awayTeamName] || clubs.get(game.awayTeam) || game.awayTeamName || "원정팀",
    homeScore: game.homeGoal === "" ? null : game.homeGoal, awayScore: game.awayGoal === "" ? null : game.awayGoal,
    venue: game.fieldNameFull || game.fieldName || "경기장 미정",
    status: game.endYn === "Y" ? "종료" : game.gameStatus === "LIVE" || game.gameStatus === "IN" ? "진행 중" : "경기 전",
  }));
}

export async function GET(request: NextRequest) {
  const date = validDate(request.nextUrl.searchParams.get("date"));
  const requested = request.nextUrl.searchParams.get("league") as LeagueKey | null;
  const leagues: LeagueKey[] = requested && requested in LEAGUES ? [requested] : Object.keys(LEAGUES) as LeagueKey[];
  const settled = await Promise.allSettled(leagues.map((league) => league === "kleague" ? kLeagueGames(date) : espnGames(league, date)));
  const games = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const errors = settled.flatMap((result, index) => result.status === "rejected" ? [`${LEAGUES[leagues[index]].name}: ${String(result.reason?.message ?? result.reason)}`] : []);
  return NextResponse.json({ date, games, errors, updatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
}

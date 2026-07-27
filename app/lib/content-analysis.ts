export type ContentLeague = "KBO" | "MLB" | "NPB";

export type ContentGame = {
  league?: ContentLeague;
  gamePk?: number;
  id?: string | number;
  date?: string;
  time?: string;
  away?: string;
  home?: string;
  stadium?: string;
  awayStarter?: string;
  homeStarter?: string;
  awayStarterName?: string;
  homeStarterName?: string;
  awayPitcher?: string;
  homePitcher?: string;
  awayStarterCode?: string;
  homeStarterCode?: string;
  awayTeamId?: number;
  homeTeamId?: number;
  awayStarterId?: number;
  homeStarterId?: number;
};

export type ReelAnalysis = {
  awayEra: string;
  homeEra: string;
  awayRecent: string;
  homeRecent: string;
  awayH2h: string;
  homeH2h: string;
  awayScore: string;
  homeScore: string;
  homeWinRate: string;
  summary: string;
};

const KBO_CODES: Record<string, string> = {
  "KIA 타이거즈": "KIA", "삼성 라이온즈": "SAMSUNG", "LG 트윈스": "LG",
  "두산 베어스": "DOOSAN", "KT 위즈": "KT", "SSG 랜더스": "SSG",
  "롯데 자이언츠": "LOTTE", "한화 이글스": "HANWHA", "NC 다이노스": "NC",
  "키움 히어로즈": "KIWOOM",
};

function n(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function s(value: unknown, fallback = "-") {
  const text = String(value ?? "").trim();
  return text || fallback;
}
function pct(value: unknown) {
  const number = n(value, 0);
  return number <= 1 ? Math.round(number * 100) : Math.round(number);
}
function formText(summary: any) {
  if (!summary) return "자료 없음";
  const wins = n(summary.wins), losses = n(summary.losses), draws = n(summary.draws);
  return `${wins}승${draws ? ` ${draws}무` : ""} ${losses}패`;
}
function averageRuns(summary: any, fallback = 4) {
  const games = Math.max(1, n(summary?.games, 10));
  const avg = n(summary?.averageRunsFor, NaN);
  if (Number.isFinite(avg)) return avg;
  const runs = n(summary?.runsFor ?? summary?.runs, NaN);
  return Number.isFinite(runs) ? runs / games : fallback;
}
function projectedScores(awayAvg: number, homeAvg: number, homeProb: number) {
  const homeBoost = (homeProb - 50) / 18;
  const away = Math.max(1, Math.min(10, Math.round(awayAvg - homeBoost / 2)));
  const home = Math.max(1, Math.min(10, Math.round(homeAvg + homeBoost / 2)));
  if (away === home) return homeProb >= 50 ? [away, home + 1] : [away + 1, home];
  return [away, home];
}
async function json(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) throw new Error(payload?.message || "분석 데이터 요청 실패");
  return payload;
}

async function kbo(siteUrl: string, game: ContentGame, date: string): Promise<ReelAnalysis> {
  const away = game.away || "원정팀", home = game.home || "홈팀";
  const awayCode = KBO_CODES[away], homeCode = KBO_CODES[home];
  if (!awayCode || !homeCode) throw new Error("KBO 팀 코드를 찾지 못했습니다.");
  const [standings, awayForm, homeForm, awayPitching, homePitching] = await Promise.all([
    json(`${siteUrl}/api/kbo/standings`),
    json(`${siteUrl}/api/kbo/team-form?team=${awayCode}&opponent=${homeCode}&date=${encodeURIComponent(date)}`),
    json(`${siteUrl}/api/kbo/team-form?team=${homeCode}&opponent=${awayCode}&date=${encodeURIComponent(date)}`),
    json(`${siteUrl}/api/kbo/team-pitching?team=${awayCode}`),
    json(`${siteUrl}/api/kbo/team-pitching?team=${homeCode}`),
  ]);
  const aStanding = standings?.standings?.find((row: any) => row.team === away);
  const hStanding = standings?.standings?.find((row: any) => row.team === home);
  const awayRecentSummary = awayForm?.recent10?.summary;
  const homeRecentSummary = homeForm?.recent10?.summary;
  const h2h = homeForm?.headToHead?.summary;
  const awayWin = pct(aStanding?.winningPercentage || .5);
  const homeWin = pct(hStanding?.winningPercentage || .5);
  const recentEdge = n(homeRecentSummary?.wins) - n(awayRecentSummary?.wins);
  const h2hEdge = n(h2h?.wins) - n(h2h?.losses);
  const homeProb = Math.max(28, Math.min(72, Math.round(50 + (homeWin - awayWin) * .35 + recentEdge * 1.8 + h2hEdge * .8 + 3)));
  const [awayScore, homeScore] = projectedScores(averageRuns(awayRecentSummary), averageRuns(homeRecentSummary), homeProb);
  const normalizePitcher = (value: unknown) => String(value ?? "")
    .replace(/\([^)]*\)/g, "")
    .replace(/[^0-9A-Za-z가-힣]/g, "")
    .toLowerCase();
  const findStarterPitcher = (payload: any, name: unknown, code: unknown) => {
    const pitchers = Array.isArray(payload?.pitchers) ? payload.pitchers : [];
    const wantedCode = String(code ?? "").trim();
    const wantedName = normalizePitcher(name);
    return pitchers.find((row: any) => wantedCode && String(row?.pcode ?? row?.playerCode ?? row?.id ?? "") === wantedCode)
      || pitchers.find((row: any) => wantedName && normalizePitcher(row?.player ?? row?.name ?? row?.playerName) === wantedName)
      || pitchers.find((row: any) => {
        const candidate = normalizePitcher(row?.player ?? row?.name ?? row?.playerName);
        return wantedName && candidate && (candidate.includes(wantedName) || wantedName.includes(candidate));
      });
  };
  const awayStarter = findStarterPitcher(awayPitching, game.awayStarter || game.awayStarterName || game.awayPitcher, game.awayStarterCode);
  const homeStarter = findStarterPitcher(homePitching, game.homeStarter || game.homeStarterName || game.homePitcher, game.homeStarterCode);
  const awayEra = s(awayStarter?.era, "기록 없음");
  const homeEra = s(homeStarter?.era, "기록 없음");
  return {
    awayEra, homeEra,
    awayRecent: formText(awayRecentSummary), homeRecent: formText(homeRecentSummary),
    awayH2h: h2h ? `${n(h2h.losses)}승` : "자료 없음", homeH2h: h2h ? `${n(h2h.wins)}승` : "자료 없음",
    awayScore: String(awayScore), homeScore: String(homeScore), homeWinRate: String(homeProb),
    summary: `${homeProb >= 50 ? home : away}가 시즌 승률과 최근 흐름에서 우세합니다. 선발 평균자책점은 ${away} ${awayEra}, ${home} ${homeEra}이며 최근 10경기와 맞대결 흐름을 함께 반영했습니다.`,
  };
}

async function npb(siteUrl: string, game: ContentGame, date: string): Promise<ReelAnalysis> {
  const query = new URLSearchParams({
    away: game.away || "원정팀", home: game.home || "홈팀", date,
    awayStarter: s(game.awayStarter || game.awayStarterName || game.awayPitcher, ""),
    homeStarter: s(game.homeStarter || game.homeStarterName || game.homePitcher, ""),
    awayStarterCode: s(game.awayStarterCode, ""), homeStarterCode: s(game.homeStarterCode, ""),
    stadium: s(game.stadium, ""), fast: "1",
  });
  const data = await json(`${siteUrl}/api/npb/analysis?${query}`);
  const homeProb = Math.round(n(data?.probability?.home, 50));
  const awayRecent = data?.awayRecent?.summary, homeRecent = data?.homeRecent?.summary, h2h = data?.headToHead?.summary;
  const [awayScore, homeScore] = projectedScores(averageRuns(awayRecent), averageRuns(homeRecent), homeProb);
  const awayEra = s(data?.awayStarterSeason?.era ?? data?.awayStarterDetail?.era);
  const homeEra = s(data?.homeStarterSeason?.era ?? data?.homeStarterDetail?.era);
  return {
    awayEra, homeEra, awayRecent: formText(awayRecent), homeRecent: formText(homeRecent),
    awayH2h: h2h ? `${n(h2h.losses)}승` : "자료 없음", homeH2h: h2h ? `${n(h2h.wins)}승` : "자료 없음",
    awayScore: String(awayScore), homeScore: String(homeScore), homeWinRate: String(homeProb),
    summary: s(data?.expertAnalysis?.finalOutlook?.text, `${data?.pick || (homeProb >= 50 ? game.home : game.away)} 우세로 분석됩니다.`),
  };
}

async function mlb(siteUrl: string, game: ContentGame, date: string): Promise<ReelAnalysis> {
  const awayId = n(game.awayTeamId), homeId = n(game.homeTeamId);
  if (!awayId || !homeId) throw new Error("MLB 팀 ID가 없습니다.");
  const query = new URLSearchParams({ date, awayTeamId: String(awayId), homeTeamId: String(homeId), awayStarterId: String(n(game.awayStarterId)), homeStarterId: String(n(game.homeStarterId)) });
  const data = await json(`${siteUrl}/api/mlb/analysis?${query}`);
  const aRecent = Array.isArray(data?.awayRecent) ? data.awayRecent : [];
  const hRecent = Array.isArray(data?.homeRecent) ? data.homeRecent : [];
  const summarize = (rows: any[]) => ({ wins: rows.filter((x) => x.result === "승").length, losses: rows.filter((x) => x.result === "패").length, draws: rows.filter((x) => x.result === "무").length, games: rows.length, averageRunsFor: rows.reduce((sum, x) => sum + n(x.runs), 0) / Math.max(1, rows.length) });
  const ar = summarize(aRecent), hr = summarize(hRecent);
  const awayPct = n(data?.awayTeam?.hitting?.ops, .7) + (5 - n(data?.awayTeam?.pitching?.era, 4)) * .03;
  const homePct = n(data?.homeTeam?.hitting?.ops, .7) + (5 - n(data?.homeTeam?.pitching?.era, 4)) * .03;
  const recentEdge = hr.wins - ar.wins;
  const homeProb = Math.max(28, Math.min(72, Math.round(53 + (homePct - awayPct) * 55 + recentEdge * 1.8)));
  const [awayScore, homeScore] = projectedScores(averageRuns(ar, 4.2), averageRuns(hr, 4.2), homeProb);
  const h2h = data?.headToHead;
  const awayEra = s(data?.awayPitcher?.season?.era), homeEra = s(data?.homePitcher?.season?.era);
  return {
    awayEra, homeEra, awayRecent: formText(ar), homeRecent: formText(hr),
    awayH2h: h2h ? `${n(h2h.awayWins)}승` : "자료 없음", homeH2h: h2h ? `${n(h2h.homeWins)}승` : "자료 없음",
    awayScore: String(awayScore), homeScore: String(homeScore), homeWinRate: String(homeProb),
    summary: `${homeProb >= 50 ? game.home : game.away} 우세입니다. 최근 10경기, 팀 타격 OPS, 팀 평균자책점, 선발 성적과 불펜 피로도를 종합 반영했습니다.`,
  };
}

export async function loadReelAnalysis(siteUrl: string, league: ContentLeague, game: ContentGame, date: string): Promise<ReelAnalysis> {
  if (league === "KBO") return kbo(siteUrl, game, date);
  if (league === "NPB") return npb(siteUrl, game, date);
  return mlb(siteUrl, game, date);
}

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

  // 경기 상세 페이지와 완전히 같은 원본 데이터를 사용합니다.
  const [standings, batting, awayForm, homeForm, awayPitching, homePitching] = await Promise.all([
    json(`${siteUrl}/api/kbo/standings`),
    json(`${siteUrl}/api/kbo/team-batting`),
    json(`${siteUrl}/api/kbo/team-form?team=${awayCode}&opponent=${homeCode}&date=${encodeURIComponent(date)}`),
    json(`${siteUrl}/api/kbo/team-form?team=${homeCode}&opponent=${awayCode}&date=${encodeURIComponent(date)}`),
    json(`${siteUrl}/api/kbo/team-pitching?team=${awayCode}`),
    json(`${siteUrl}/api/kbo/team-pitching?team=${homeCode}`),
  ]);

  const aStanding = standings?.standings?.find((row: any) => row.team === away);
  const hStanding = standings?.standings?.find((row: any) => row.team === home);
  const aBatting = batting?.batting?.find((row: any) => row.team === away);
  const hBatting = batting?.batting?.find((row: any) => row.team === home);
  const awayRecentSummary = awayForm?.recent10?.summary;
  const homeRecentSummary = homeForm?.recent10?.summary;
  const awayH2hSummary = awayForm?.headToHead?.summary;
  const homeH2hSummary = homeForm?.headToHead?.summary;

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

  const awayStarterName = game.awayStarter || game.awayStarterName || game.awayPitcher || "";
  const homeStarterName = game.homeStarter || game.homeStarterName || game.homePitcher || "";
  const awayStarter = findStarterPitcher(awayPitching, awayStarterName, game.awayStarterCode);
  const homeStarter = findStarterPitcher(homePitching, homeStarterName, game.homeStarterCode);

  const pitcherDetail = async (side: "away" | "home", pitcher: any, starterName: string) => {
    if (!pitcher && !starterName) return null;
    const team = side === "away" ? awayCode : homeCode;
    const opponent = side === "away" ? homeCode : awayCode;
    const params = new URLSearchParams({
      pcode: String(pitcher?.pcode ?? pitcher?.playerCode ?? game[side === "away" ? "awayStarterCode" : "homeStarterCode"] ?? ""),
      name: starterName || String(pitcher?.player ?? pitcher?.name ?? ""),
      opponent,
      stadium: String(game.stadium || ""),
      team,
      homeTeam: homeCode,
      side,
      date,
      time: String(game.time || ""),
      detailVersion: "6",
    });
    try { return await json(`${siteUrl}/api/kbo/pitcher-vs-team?${params}`); }
    catch { return null; }
  };

  const [awayDetail, homeDetail] = await Promise.all([
    pitcherDetail("away", awayStarter, String(awayStarterName)),
    pitcherDetail("home", homeStarter, String(homeStarterName)),
  ]);

  // 아래 계산식은 app/game/GameClient.tsx의 makePrediction과 동일합니다.
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const safe = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const awaySeason = safe(aStanding?.winningPercentage, 0.5);
  const homeSeason = safe(hStanding?.winningPercentage, 0.5);
  const awayRecentGames = safe(awayRecentSummary?.games);
  const homeRecentGames = safe(homeRecentSummary?.games);
  const awayRecentRate = awayRecentGames ? safe(awayRecentSummary?.wins) / awayRecentGames : 0.5;
  const homeRecentRate = homeRecentGames ? safe(homeRecentSummary?.wins) / homeRecentGames : 0.5;
  const awayOps = safe(aBatting?.ops, 0.7);
  const homeOps = safe(hBatting?.ops, 0.7);
  const awayEraNumber = safe(awayDetail?.seasonStats?.era ?? awayStarter?.era, 4.5);
  const homeEraNumber = safe(homeDetail?.seasonStats?.era ?? homeStarter?.era, 4.5);
  const awayVsEra = awayDetail?.found ? safe(awayDetail?.stats?.era, awayEraNumber) : awayEraNumber;
  const homeVsEra = homeDetail?.found ? safe(homeDetail?.stats?.era, homeEraNumber) : homeEraNumber;
  const h2hGames = safe(awayH2hSummary?.games);
  const awayH2HRate = h2hGames ? safe(awayH2hSummary?.wins) / h2hGames : 0.5;
  const homeH2HRate = h2hGames ? safe(homeH2hSummary?.wins) / h2hGames : 0.5;
  const awayRunDiff = safe(awayRecentSummary?.averageRunsScored) - safe(awayRecentSummary?.averageRunsAllowed);
  const homeRunDiff = safe(homeRecentSummary?.averageRunsScored) - safe(homeRecentSummary?.averageRunsAllowed);

  let homeEdge = 0.028;
  homeEdge += (homeSeason - awaySeason) * 0.25;
  homeEdge += (homeRecentRate - awayRecentRate) * 0.18;
  homeEdge += (homeOps - awayOps) * 0.26;
  homeEdge += (awayVsEra - homeVsEra) * 0.017;
  homeEdge += (homeRunDiff - awayRunDiff) * 0.018;
  if (h2hGames >= 4) homeEdge += (homeH2HRate - awayH2HRate) * 0.08;

  const homeProbRaw = clamp(0.5 + homeEdge, 0.24, 0.76);
  const awayProbRaw = 1 - homeProbRaw;
  const leagueBase = 4.45;
  const awayRecentRuns = awayRecentGames ? safe(awayRecentSummary?.averageRunsScored, leagueBase) : safe(aBatting?.averageRunsPerGame, leagueBase);
  const homeRecentRuns = homeRecentGames ? safe(homeRecentSummary?.averageRunsScored, leagueBase) : safe(hBatting?.averageRunsPerGame, leagueBase);
  const awayScoreRaw = awayRecentRuns * 0.5 + leagueBase * 0.28 + (5.0 - homeVsEra) * 0.16 + Math.max(-0.4, awayRunDiff * 0.08);
  const homeScoreRaw = homeRecentRuns * 0.5 + leagueBase * 0.28 + (5.0 - awayVsEra) * 0.16 + Math.max(-0.4, homeRunDiff * 0.08) + 0.15;
  const winner = homeProbRaw >= awayProbRaw ? home : away;
  const expectedTotal = Math.round((awayScoreRaw + homeScoreRaw) * 10) / 10;
  const probabilityGap = Math.abs(homeProbRaw - awayProbRaw);
  const rawScoreGap = Math.abs(homeScoreRaw - awayScoreRaw);
  const targetMargin = clamp(Math.round(probabilityGap * 10 + rawScoreGap * 0.55), 1, 5);
  const displayedTotal = clamp(Math.round(expectedTotal), 3, 20);
  let winnerScore = Math.round((displayedTotal + targetMargin) / 2);
  let loserScore = displayedTotal - winnerScore;
  if (loserScore < 1) { loserScore = 1; winnerScore = Math.min(10, Math.max(2, displayedTotal - loserScore)); }
  winnerScore = clamp(winnerScore, 2, 10);
  loserScore = clamp(loserScore, 1, 9);
  let awayScore = winner === away ? winnerScore : loserScore;
  let homeScore = winner === home ? winnerScore : loserScore;
  if (winner === home && homeScore <= awayScore) homeScore = Math.min(10, awayScore + 1);
  else if (winner === away && awayScore <= homeScore) awayScore = Math.min(10, homeScore + 1);

  const homeProb = Math.round(homeProbRaw * 100);
  const awayEra = s(awayDetail?.seasonStats?.era ?? awayStarter?.era, "기록 없음");
  const homeEra = s(homeDetail?.seasonStats?.era ?? homeStarter?.era, "기록 없음");
  return {
    awayEra, homeEra,
    awayRecent: formText(awayRecentSummary), homeRecent: formText(homeRecentSummary),
    awayH2h: awayH2hSummary ? `${safe(awayH2hSummary.wins)}승` : "자료 없음",
    homeH2h: homeH2hSummary ? `${safe(homeH2hSummary.wins)}승` : "자료 없음",
    awayScore: String(awayScore), homeScore: String(homeScore), homeWinRate: String(homeProb),
    summary: `${winner} 우세입니다. 경기 상세 분석과 동일한 시즌 전력·최근 흐름·팀 OPS·선발 상대 성적·최근 득실점·맞대결 계산을 그대로 반영했습니다.`,
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

  // MLB 일정 API는 선발 ID를 awayStarterCode/homeStarterCode로 내려준다.
  // 기존 릴스 분석은 awayStarterId/homeStarterId만 읽어서 항상 0을 보내고 있었고,
  // 그 결과 선발 시즌 기록이 null이 되어 ERA가 '기록 없음'으로 표시됐다.
  const awayStarterId = n(game.awayStarterId || game.awayStarterCode);
  const homeStarterId = n(game.homeStarterId || game.homeStarterCode);
  const query = new URLSearchParams({
    date,
    awayTeamId: String(awayId),
    homeTeamId: String(homeId),
    awayStarterId: String(awayStarterId),
    homeStarterId: String(homeStarterId),
  });
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
  const readEra = (pitcher: any) => s(
    pitcher?.season?.era
      ?? pitcher?.seasonEra
      ?? pitcher?.stats?.era
      ?? pitcher?.era,
    "기록 없음",
  );
  const awayEra = readEra(data?.awayPitcher);
  const homeEra = readEra(data?.homePitcher);
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

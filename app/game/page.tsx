"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type KboStanding = {
  rank: number;
  teamCode: string;
  team: string;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  winningPercentage: number;
  gamesBehind: string;
  streak: string;
  home: string;
  away: string;
};

type TeamBatting = {
  teamCode: string;
  team: string;
  games: number;
  plateAppearances: number;
  atBats: number;
  runs: number;
  hits: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  totalBases: number;
  rbi: number;
  walks: number;
  strikeouts: number;
  battingAverage: number;
  onBasePercentage: number;
  sluggingPercentage: number;
  ops: number;
  scoringPositionAverage: number;
  averageRunsPerGame: number;
};

type TeamPitcher = {
  pcode: string;
  player: string;
  teamCode: string;
  team: string;
  era: number;
  games: number;
  completeGames: number;
  shutouts: number;
  wins: number;
  losses: number;
  saves: number;
  holds: number;
  winningPercentage: number;
  plateAppearances: number;
  pitches: number;
  innings: string;
  inningsValue: number;
  hits: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  walks: number;
  hitByPitch: number;
  strikeouts: number;
  runs: number;
  earnedRuns: number;
  whip: number;
};

type OpponentPitchingStats = {
  opponent: string;
  games: number;
  era: number;
  wins: number;
  losses: number;
  saves: number;
  holds: number;
  winningPercentage: number;
  battersFaced: number;
  innings: string;
  inningsValue: number;
  hits: number;
  homeRuns: number;
  walks: number;
  hitByPitch: number;
  strikeouts: number;
  runs: number;
  earnedRuns: number;
  opponentAverage: number;
  whip: number;
};

type TeamGame = {
  date: string;
  weekday: string;
  opponent: string;
  location: "홈" | "원정";
  teamScore: number;
  opponentScore: number;
  result: "승" | "패" | "무";
  stadium: string;
};

type FormSummary = {
  games: number;
  wins: number;
  losses: number;
  draws: number;
  runsScored: number;
  runsAllowed: number;
  averageRunsScored: number;
  averageRunsAllowed: number;
  form: string;
};

type TeamFormSection = {
  summary: FormSummary;
  games: TeamGame[];
};

type TeamFormResponse = {
  success: boolean;
  teamCode: string;
  team: string;
  opponentCode: string;
  opponent: string;
  recent10: TeamFormSection;
  headToHead: TeamFormSection;
  weekday?: { label: string; summary: FormSummary; games: TeamGame[] };
  message?: string;
};

type VenuePitchingStats = { venue: string; games: number; wins: number; losses: number; winningPercentage: number; innings: string; era: number; whip: number };
type RecentPitchingSummary = { games: number; wins: number; losses: number; innings: string; era: number; whip: number; qualityStarts: number };

type PitcherVsTeamResponse = {
  success: boolean;
  pcode: string;
  playerName: string;
  opponent: string;
  found: boolean;
  stats: OpponentPitchingStats | null;
  stadium?: string;
  venueStats?: VenuePitchingStats[];
  currentVenueStats?: VenuePitchingStats | null;
  recent5?: RecentPitchingSummary | null;
  recent10?: RecentPitchingSummary | null;
  seasonStats?: { games:number; wins:number; losses:number; innings:string; era:number; whip:number } | null;
  message?: string;
};

type StandingsResponse = {
  success: boolean;
  standings: KboStanding[];
  message?: string;
};

type BattingResponse = {
  success: boolean;
  batting: TeamBatting[];
  message?: string;
};

type PitchingResponse = {
  success: boolean;
  pitchers: TeamPitcher[];
  message?: string;
};



type Prediction = {
  awayWinProbability: number;
  homeWinProbability: number;
  awayScore: number;
  homeScore: number;
  totalLine: number;
  totalPick: "오버" | "언더";
  winner: string;
  confidence: number;
  confidenceGrade: "A" | "B" | "C";
  factors: Array<{ label: string; away: number; home: number; weight: number }>;
  reasons: string[];
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function safe(value: number | undefined, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function makePrediction({
  awayName, homeName, awayStanding, homeStanding, awayBatting, homeBatting,
  awayStarter, homeStarter, awayForm, homeForm,
}: {
  awayName: string; homeName: string; awayStanding?: KboStanding; homeStanding?: KboStanding;
  awayBatting?: TeamBatting; homeBatting?: TeamBatting; awayStarter?: StarterData; homeStarter?: StarterData;
  awayForm: TeamFormResponse | null; homeForm: TeamFormResponse | null;
}): Prediction {
  const awaySeason = safe(awayStanding?.winningPercentage, .5);
  const homeSeason = safe(homeStanding?.winningPercentage, .5);
  const awayRecentGames = safe(awayForm?.recent10.summary.games);
  const homeRecentGames = safe(homeForm?.recent10.summary.games);
  const awayRecent = awayRecentGames ? safe(awayForm?.recent10.summary.wins) / awayRecentGames : .5;
  const homeRecent = homeRecentGames ? safe(homeForm?.recent10.summary.wins) / homeRecentGames : .5;
  const awayOps = safe(awayBatting?.ops, .7);
  const homeOps = safe(homeBatting?.ops, .7);
  const awayEra = awayStarter && awayStarter.pitcher.era >= 0 ? awayStarter.pitcher.era : 4.5;
  const homeEra = homeStarter && homeStarter.pitcher.era >= 0 ? homeStarter.pitcher.era : 4.5;
  const awayVsEra = awayStarter?.opponentStats?.era ?? awayEra;
  const homeVsEra = homeStarter?.opponentStats?.era ?? homeEra;
  const awayH2H = awayForm?.headToHead.summary;
  const homeH2H = homeForm?.headToHead.summary;
  const h2hGames = safe(awayH2H?.games);
  const awayH2HRate = h2hGames ? safe(awayH2H?.wins) / h2hGames : .5;
  const homeH2HRate = h2hGames ? safe(homeH2H?.wins) / h2hGames : .5;
  const awayRunDiff = safe(awayForm?.recent10.summary.averageRunsScored) - safe(awayForm?.recent10.summary.averageRunsAllowed);
  const homeRunDiff = safe(homeForm?.recent10.summary.averageRunsScored) - safe(homeForm?.recent10.summary.averageRunsAllowed);

  let homeEdge = 0.028; // 기본 홈 이점
  homeEdge += (homeSeason - awaySeason) * .25;
  homeEdge += (homeRecent - awayRecent) * .18;
  homeEdge += (homeOps - awayOps) * .26;
  homeEdge += (awayVsEra - homeVsEra) * .017;
  homeEdge += (homeRunDiff - awayRunDiff) * .018;
  if (h2hGames >= 4) homeEdge += (homeH2HRate - awayH2HRate) * .08;

  const homeProb = clamp(.5 + homeEdge, .24, .76);
  const awayProb = 1 - homeProb;

  const leagueBase = 4.45;
  const awayRecentRuns = awayRecentGames ? safe(awayForm?.recent10.summary.averageRunsScored, leagueBase) : safe(awayBatting?.averageRunsPerGame, leagueBase);
  const homeRecentRuns = homeRecentGames ? safe(homeForm?.recent10.summary.averageRunsScored, leagueBase) : safe(homeBatting?.averageRunsPerGame, leagueBase);
  const awayScoreRaw = awayRecentRuns * .50 + leagueBase * .28 + (5.0 - homeVsEra) * .16 + Math.max(-.4, awayRunDiff * .08);
  const homeScoreRaw = homeRecentRuns * .50 + leagueBase * .28 + (5.0 - awayVsEra) * .16 + Math.max(-.4, homeRunDiff * .08) + .15;
  let awayScore = clamp(Math.round(awayScoreRaw), 1, 10);
  let homeScore = clamp(Math.round(homeScoreRaw), 1, 10);
  const winner = homeProb >= awayProb ? homeName : awayName;

  // 승리 확률과 예상 스코어가 서로 모순되지 않도록 보정합니다.
  // KBO는 무승부가 가능하지만, 이 카드는 최종 승리팀 예측을 보여주므로
  // 추천 팀이 반드시 1점 이상 앞선 스코어로 표시됩니다.
  if (winner === homeName && homeScore <= awayScore) {
    homeScore = awayScore < 10 ? awayScore + 1 : 10;
    if (homeScore === awayScore) awayScore = Math.max(1, homeScore - 1);
  } else if (winner === awayName && awayScore <= homeScore) {
    awayScore = homeScore < 10 ? homeScore + 1 : 10;
    if (awayScore === homeScore) homeScore = Math.max(1, awayScore - 1);
  }

  const totalLine = 0;
  const totalPick = awayScore + homeScore >= 9 ? "오버" : "언더";

  const signals = [
    Math.sign(homeSeason - awaySeason),
    Math.sign(homeRecent - awayRecent),
    Math.sign(homeOps - awayOps),
    Math.sign(awayVsEra - homeVsEra),
    Math.sign(homeRunDiff - awayRunDiff),
    h2hGames >= 4 ? Math.sign(homeH2HRate - awayH2HRate) : 0,
  ].filter((value) => value !== 0);
  const homeSignals = signals.filter((value) => value > 0).length;
  const awaySignals = signals.filter((value) => value < 0).length;
  const agreement = signals.length ? Math.max(homeSignals, awaySignals) / signals.length : .5;
  const dataCoverage = [awayStanding, homeStanding, awayBatting, homeBatting, awayStarter, homeStarter, awayForm, homeForm]
    .filter(Boolean).length / 8;
  const confidence = Math.round(clamp(52 + agreement * 20 + dataCoverage * 13 + Math.abs(homeProb - .5) * 30, 50, 88));

  const favorite = homeProb >= awayProb ? homeName : awayName;
  const underdog = favorite === homeName ? awayName : homeName;
  const favoriteProb = Math.max(homeProb, awayProb) * 100;
  const reasons: string[] = [];

  const seasonLeader = homeSeason >= awaySeason ? homeName : awayName;
  const recentLeader = homeRecent >= awayRecent ? homeName : awayName;
  const offenseLeader = homeOps >= awayOps ? homeName : awayName;
  const starterLeader = homeVsEra <= awayVsEra ? homeName : awayName;
  const runDiffLeader = homeRunDiff >= awayRunDiff ? homeName : awayName;

  reasons.push(`${favorite}를 우세로 보지만 예상 승률은 ${favoriteProb.toFixed(0)}% 수준으로, 무조건적인 강추천 구간은 아닙니다.`);

  if (seasonLeader === recentLeader && recentLeader === offenseLeader) {
    reasons.push(`${seasonLeader}는 시즌 승률·최근 흐름·팀 OPS가 같은 방향을 가리켜 기본 전력 신호가 일치합니다.`);
  } else {
    reasons.push(`시즌 승률은 ${seasonLeader}, 최근 흐름은 ${recentLeader}, 공격 지표는 ${offenseLeader}가 앞서 신호가 엇갈립니다. 한 지표만 보고 접근하기 어려운 경기입니다.`);
  }

  if (starterLeader === runDiffLeader) {
    reasons.push(`${starterLeader}는 선발의 상대팀 성적과 최근 득실점 마진이 함께 우세해 경기 초반부터 중반까지 주도권을 잡을 가능성이 있습니다.`);
  } else {
    reasons.push(`선발 매치업은 ${starterLeader}가 낫지만 최근 팀 득실점 흐름은 ${runDiffLeader}가 우세해, 선발 교체 이후 흐름이 바뀔 위험이 있습니다.`);
  }

  if (h2hGames >= 4) {
    const h2hLeader = awayH2HRate >= homeH2HRate ? awayName : homeName;
    reasons.push(`이번 시즌 맞대결 ${h2hGames}경기에서는 ${h2hLeader}가 더 높은 승률을 기록했습니다. 다만 맞대결은 현재 선발·불펜 상태보다 낮은 비중으로 반영했습니다.`);
  } else {
    reasons.push(`시즌 맞대결 표본이 ${h2hGames}경기로 적어 상대전적은 핵심 근거가 아니라 보조 지표로만 반영했습니다.`);
  }

  const total = awayScore + homeScore;
  reasons.push(`예상 총점은 ${total}점입니다. 실제 언더오버 추천은 베트맨 기준점과 최소 1점 이상 차이가 날 때만 강하게 판단해야 합니다.`);
  if (agreement < .67) reasons.push(`${underdog} 쪽 우세 신호도 남아 있어 배당과 AI 확률 차이가 충분하지 않으면 관망이 합리적입니다.`);

  const factors = [
    { label: "시즌 전력", away: clamp(Math.round(awaySeason * 100), 20, 90), home: clamp(Math.round(homeSeason * 100), 20, 90), weight: 18 },
    { label: "최근 흐름", away: clamp(Math.round(awayRecent * 100), 20, 90), home: clamp(Math.round(homeRecent * 100), 20, 90), weight: 16 },
    { label: "공격력", away: clamp(Math.round(50 + (awayOps - .72) * 160), 20, 90), home: clamp(Math.round(50 + (homeOps - .72) * 160), 20, 90), weight: 17 },
    { label: "선발 매치업", away: clamp(Math.round(82 - awayVsEra * 8), 20, 90), home: clamp(Math.round(82 - homeVsEra * 8), 20, 90), weight: 22 },
    { label: "최근 득실점", away: clamp(Math.round(50 + awayRunDiff * 8), 20, 90), home: clamp(Math.round(50 + homeRunDiff * 8), 20, 90), weight: 15 },
    { label: "맞대결", away: clamp(Math.round(awayH2HRate * 100), 25, 75), home: clamp(Math.round(homeH2HRate * 100), 25, 75), weight: 7 },
    { label: "홈 이점", away: 45, home: 58, weight: 5 },
  ];
  const confidenceGrade: "A" | "B" | "C" = confidence >= 80 ? "A" : confidence >= 68 ? "B" : "C";

  return {
    awayWinProbability: Math.round(awayProb * 100),
    homeWinProbability: Math.round(homeProb * 100),
    awayScore,
    homeScore,
    totalLine,
    totalPick,
    winner,
    confidence,
    confidenceGrade,
    factors,
    reasons,
  };
}

function parseBullpenText(value: string) {
  return value.split(/\n+/).map((line) => {
    const [name = "", innings = "", pitches = ""] = line.split(",").map((item) => item.trim());
    return { name, innings, pitches: Number(pitches) || 0 };
  }).filter((row) => row.name);
}

function bullpenLevel(rows: Array<{ pitches: number }>, twoDayPitches: number) {
  const yesterday = rows.reduce((sum, row) => sum + row.pitches, 0);
  const maxPitch = rows.reduce((max, row) => Math.max(max, row.pitches), 0);
  const score = yesterday + twoDayPitches * 0.45 + (maxPitch >= 25 ? 15 : 0) + (rows.length >= 4 ? 12 : 0);
  if (score >= 95) return { label: "높음", score: Math.min(100, Math.round(score)), note: "필승조 연투와 마무리 가용성을 반드시 확인해야 합니다." };
  if (score >= 55) return { label: "보통", score: Math.min(100, Math.round(score)), note: "일부 핵심 불펜의 등판 가능성이 제한될 수 있습니다." };
  return { label: "낮음", score: Math.min(100, Math.round(score)), note: "최근 소모가 크지 않아 후반 운영 여유가 있습니다." };
}

type BullpenResponse = {
  success: boolean;
  status: "received" | "unavailable" | "error";
  latestGameDate?: string | null;
  pitchers: Array<{ name: string; innings: string; pitches: number; battersFaced?: number; date: string; consecutiveDays: number }>;
  fatigue: { score: number; label: string; yesterdayPitches: number; recent3DayPitches: number; yesterdayBattersFaced?:number; recent3DayBattersFaced?:number; pitcherCount: number; heavyPitchers: number } | null;
  message?: string;
};

type BetmanMarketResponse = {
  success: boolean;
  status: "received" | "unavailable" | "error";
  gmTs?: number;
  message?: string;
  market: {
    moneyline: { away: number; home: number; draw?: number } | null;
    handicap: { line: number; away: number; home: number; draw?: number } | null;
    total: { line: number; under: number; over: number } | null;
    history: {
      moneyline: Array<{ at: string; away?: number; home?: number }>;
      handicap: Array<{ at: string; away?: number; home?: number; line?: number }>;
      total: Array<{ at: string; under?: number; over?: number; line?: number }>;
    };
  } | null;
};

function AdvancedAnalysisSection({ prediction, away, home, awayForm, homeForm, date }: {
  prediction: Prediction; away: string; home: string; awayForm: TeamFormResponse | null; homeForm: TeamFormResponse | null; date: string;
}) {
  const [betman, setBetman] = useState<BetmanMarketResponse | null>(null);
  const [marketLoading, setMarketLoading] = useState(true);
  const [awayBullpen, setAwayBullpen] = useState<BullpenResponse | null>(null);
  const [homeBullpen, setHomeBullpen] = useState<BullpenResponse | null>(null);
  const [bullpenLoading, setBullpenLoading] = useState(true);
  const [sameOdds, setSameOdds] = useState<{games:number;wins:number;losses:number;rate:number;range:string}|null>(null);

  useEffect(() => {
    let active = true; setMarketLoading(true);
    fetch(`/api/betman?date=${encodeURIComponent(date)}&away=${encodeURIComponent(away)}&home=${encodeURIComponent(home)}`, { cache: "no-store" })
      .then(r=>r.json()).then(data=>{if(active)setBetman(data)}).catch(error=>{if(active)setBetman({success:false,status:"error",market:null,message:error instanceof Error?error.message:"배당 수신 실패"})})
      .finally(()=>{if(active)setMarketLoading(false)});
    return ()=>{active=false};
  }, [date, away, home]);

  useEffect(() => {
    const market = betman?.market?.moneyline;
    if (!market || typeof window === "undefined") return;
    const key = "sports-ai-kbo-odds-history-v1";
    const raw = window.localStorage.getItem(key);
    const rows: Array<{date:string;team:string;odds:number;result?:"승"|"패"}> = raw ? JSON.parse(raw) : [];
    const candidates = [{team:away,odds:market.away,form:awayForm},{team:home,odds:market.home,form:homeForm}];
    for (const item of candidates) {
      if (!rows.some((row)=>row.date===date&&row.team===item.team)) rows.push({date,team:item.team,odds:item.odds});
      for (const row of rows.filter((row)=>row.team===item.team&&!row.result)) {
        const game=item.form?.recent10.games.find((g)=>g.date===row.date);
        if (game && game.result!=="무") row.result=game.result;
      }
    }
    window.localStorage.setItem(key, JSON.stringify(rows.slice(-1000)));
    const favorite = market.away <= market.home ? {team:away,odds:market.away} : {team:home,odds:market.home};
    const low=favorite.odds-.05, high=favorite.odds+.05;
    const sample=rows.filter((row)=>row.team===favorite.team&&row.odds>=low&&row.odds<=high&&row.result);
    const wins=sample.filter((row)=>row.result==="승").length;
    setSameOdds({games:sample.length,wins,losses:sample.length-wins,rate:sample.length?wins/sample.length*100:0,range:`${low.toFixed(2)}~${high.toFixed(2)}`});
  }, [betman, date, away, home, awayForm, homeForm]);

  useEffect(() => {
    let active=true; setBullpenLoading(true);
    Promise.all([away,home].map(team=>fetch(`/api/kbo/bullpen-fatigue?date=${encodeURIComponent(date)}&team=${encodeURIComponent(team)}`,{cache:"no-store"}).then(r=>r.json())))
      .then(([a,h])=>{if(active){setAwayBullpen(a);setHomeBullpen(h)}})
      .catch(()=>{if(active){setAwayBullpen(null);setHomeBullpen(null)}})
      .finally(()=>{if(active)setBullpenLoading(false)});
    return ()=>{active=false};
  },[date,away,home]);

  const moneyline=betman?.market?.moneyline; const total=betman?.market?.total;
  const a=moneyline?.away??0,h=moneyline?.home??0;
  const marketAway=a>1&&h>1?(1/a)/(1/a+1/h)*100:null; const marketHome=marketAway==null?null:100-marketAway;
  const awayGap=marketAway==null?null:prediction.awayWinProbability-marketAway; const homeGap=marketHome==null?null:prediction.homeWinProbability-marketHome;
  const predictedTotal=prediction.awayScore+prediction.homeScore;
  const totalPick=total?(predictedTotal>=total.line+1?"오버":predictedTotal<=total.line-1?"언더":"패스"):null;
  const bestGap=awayGap==null||homeGap==null?null:Math.max(awayGap,homeGap);
  const aiTeam=awayGap==null||homeGap==null?null:(awayGap>=homeGap?away:home);
  const weekdayAway=awayForm?.weekday?.summary, weekdayHome=homeForm?.weekday?.summary;
  const weekdayLabel=awayForm?.weekday?.label||homeForm?.weekday?.label||"해당 요일";
  const awayWeekRate=weekdayAway?.games?weekdayAway.wins/weekdayAway.games*100:null; const homeWeekRate=weekdayHome?.games?weekdayHome.wins/weekdayHome.games*100:null;
  const af=awayBullpen?.fatigue, hf=homeBullpen?.fatigue;
  const bullpenAdvantage=!af||!hf?null:af.score===hf.score?"비슷":af.score<hf.score?away:home;
  const marketSentence=bestGap==null?"현재 배당을 불러오지 못해 AI 예상 승률과 배당 기준 승률 비교는 제외했습니다.":`${aiTeam}의 AI 예상 승률은 배당 기준 승률보다 ${Math.abs(bestGap).toFixed(1)}%p ${bestGap>=0?"높습니다":"낮습니다"}.`;
  const weekdaySentence=awayWeekRate==null||homeWeekRate==null?`${weekdayLabel} 경기 표본이 부족해 핵심 근거에서는 제외했습니다.`:`${weekdayLabel} 승률은 ${away} ${awayWeekRate.toFixed(1)}%, ${home} ${homeWeekRate.toFixed(1)}%입니다.`;
  const bullpenSentence=bullpenAdvantage?`최근 3일 실제 투구 기록을 반영한 후반 운영 우위는 ${bullpenAdvantage}입니다.`:"최근 경기 투수 상세 기록이 없어 불펜 피로도는 최종 판단에서 제외했습니다.";

  return <section className="mt-10 space-y-6">
    <div className="rounded-3xl border border-amber-800/60 bg-amber-950/20 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-black text-amber-400">BETMAN LIVE MARKET</p><h2 className="mt-2 text-2xl font-black">베트맨 배당 · AI 확률 비교</h2></div><span className={`rounded-full border px-3 py-1 text-xs font-bold ${marketLoading?"border-slate-700 text-slate-400":betman?.status==="received"?"border-emerald-700 text-emerald-300":"border-amber-700 text-amber-300"}`}>{marketLoading?"불러오는 중":betman?.status==="received"?`자동 수신 완료 · ${betman.gmTs??""}`:"배당 미수신"}</span></div>
      <p className="mt-3 text-sm leading-6 text-slate-400">현재 배당이 나타내는 승률과 SPORTS AI 예상 승률을 전문가 분석 근거와 함께 비교합니다.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl bg-slate-950 p-5"><p className="text-xs text-slate-500">베트맨 승패 배당</p><p className="mt-3 font-black">{moneyline?`${away} ${moneyline.away.toFixed(2)} · ${home} ${moneyline.home.toFixed(2)}`:"미수신"}</p></div>
        <div className="rounded-2xl bg-slate-950 p-5"><p className="text-xs text-slate-500">배당 기준 승률</p><p className="mt-3 font-black">{marketAway==null?"미수신":`${away} ${marketAway.toFixed(1)}% · ${home} ${marketHome!.toFixed(1)}%`}</p></div>
        <div className="rounded-2xl bg-slate-950 p-5"><p className="text-xs text-slate-500">AI 확률 비교</p><p className="mt-3 text-xl font-black text-amber-400">{aiTeam??"-"}</p><p className="mt-1 text-xs font-bold text-amber-300">{bestGap==null?"배당 미수신":`배당 기준과 ${Math.abs(bestGap).toFixed(1)}%p 차이`}</p></div>
        <div className="rounded-2xl bg-slate-950 p-5"><p className="text-xs text-slate-500">실제 U/O 기준</p><p className="mt-3 text-xl font-black text-amber-400">{total?`${total.line} ${totalPick}`:"미수신"}</p><p className="mt-1 text-xs text-slate-500">언더 {total?.under?.toFixed(2)??"-"} · 오버 {total?.over?.toFixed(2)??"-"} · AI {predictedTotal}점</p></div>
      </div>
      <div className="mt-4 rounded-2xl border border-amber-900/70 bg-slate-950 p-5">
        <p className="text-xs text-slate-500">동일 배당 구간 실제 기록</p>
        <p className="mt-2 font-black">{sameOdds && sameOdds.games > 0 ? `${sameOdds.range} · ${sameOdds.games}경기 ${sameOdds.wins}승 ${sameOdds.losses}패 · 실제 승률 ${sameOdds.rate.toFixed(1)}%` : "동일 배당 기록 누적 중"}</p>
        <p className="mt-2 text-xs leading-5 text-slate-500">현재 브라우저에서 자동 수집한 실제 경기 결과 기준입니다. 표본 수가 적으면 참고용으로만 표시됩니다.</p>
      </div>
    </div>

    <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-black text-blue-400">불펜 피로도 자동 분석</p><h2 className="mt-2 text-2xl font-black">최근 경기 불펜 등판 기록</h2></div><span className="text-xs font-bold text-slate-400">{bullpenLoading?"기록 불러오는 중":"최근 3일 자동 반영"}</span></div>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {[[away,awayBullpen],[home,homeBullpen]].map(([team,data])=>{const d=data as BullpenResponse|null; return <article key={team as string} className="rounded-2xl bg-slate-950 p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-black">{team as string}</h3><span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-black">피로도 {d?.fatigue?.label??"확인 중"}</span></div>
          {d?.status==="received"?<><p className="mt-2 text-xs text-slate-500">최근 경기 {d.latestGameDate} · 상대 타자 {d.fatigue?.yesterdayBattersFaced??0}명 · 최근 3일 {d.fatigue?.recent3DayBattersFaced??0}명</p><div className="mt-4 space-y-2">{d.pitchers.map((row,index)=><div key={`${row.name}-${index}`} className="flex justify-between rounded-lg bg-slate-900 px-3 py-2 text-sm"><span>{row.name} · {row.innings}이닝</span><b>{row.pitches>0?`${row.pitches}구`:`상대타자 ${row.battersFaced??0}명`}</b></div>)}</div></>:<p className="mt-4 rounded-xl bg-slate-900 p-4 text-sm leading-6 text-slate-400">{bullpenLoading?"전날 등판 투수를 자동으로 확인하고 있습니다.":d?.message??"최근 불펜 기록을 불러오지 못했습니다."}</p>}
        </article>})}
      </div>
    </div>

    <div className="grid gap-5 md:grid-cols-2">
      <article className="rounded-3xl border border-slate-800 bg-slate-900 p-6"><p className="text-sm font-black text-blue-400">요일별 팀 성적</p><h3 className="mt-2 text-xl font-black">{weekdayLabel} 경기 승률</h3><div className="mt-5 space-y-3"><div className="rounded-xl bg-slate-950 p-4">{away} · {weekdayAway?.games?`${weekdayAway.wins}승 ${weekdayAway.draws}무 ${weekdayAway.losses}패 (${awayWeekRate?.toFixed(1)}%)`:"기록 없음"}</div><div className="rounded-xl bg-slate-950 p-4">{home} · {weekdayHome?.games?`${weekdayHome.wins}승 ${weekdayHome.draws}무 ${weekdayHome.losses}패 (${homeWeekRate?.toFixed(1)}%)`:"기록 없음"}</div></div></article>
      <article className="rounded-3xl border border-slate-800 bg-slate-900 p-6"><p className="text-sm font-black text-blue-400">전문가 종합 분석</p><h3 className="mt-2 text-xl font-black">최종 분석 결과</h3><div className="mt-5 space-y-3 text-sm leading-7 text-slate-300"><p>• {marketSentence}</p><p>• {weekdaySentence}</p><p>• {bullpenSentence}</p><p>• 선발·타격·최근 득실점·맞대결·홈 이점을 함께 반영해 최종 픽을 산출합니다.</p></div></article>
    </div>
  </section>;
}

function PredictionSection({ prediction, away, home }: { prediction: Prediction; away: string; home: string }) {
  return (
    <section className="mt-10 rounded-3xl border border-blue-800 bg-gradient-to-br from-blue-950/50 to-slate-900 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-sm font-black text-blue-400">SPORTS AI 종합 예측</p><h2 className="mt-2 text-2xl font-black">{prediction.winner} 승 추천</h2></div>
        <span className="rounded-full bg-blue-600 px-4 py-2 text-sm font-black">신뢰도 {prediction.confidence}%</span>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-slate-950 p-5"><p className="text-xs text-slate-500">승리 확률</p><div className="mt-4 flex justify-between font-black"><span>{away} {prediction.awayWinProbability}%</span><span>{home} {prediction.homeWinProbability}%</span></div><div className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-800"><div className="bg-slate-500" style={{width:`${prediction.awayWinProbability}%`}}/><div className="bg-blue-600" style={{width:`${prediction.homeWinProbability}%`}}/></div></div>
        <div className="rounded-2xl bg-slate-950 p-5 text-center"><p className="text-xs text-slate-500">예상 스코어</p><p className="mt-3 text-3xl font-black">{prediction.awayScore} : {prediction.homeScore}</p><p className="mt-2 text-xs text-slate-500">{away} · {home}</p></div>
        <div className="rounded-2xl bg-slate-950 p-5 text-center"><p className="text-xs text-slate-500">언더/오버</p><p className="mt-3 text-3xl font-black text-blue-400">{prediction.awayScore + prediction.homeScore}점</p><p className="mt-2 text-xs text-slate-500">AI 예상 총득점 · 시장 기준점은 아래에서 비교</p></div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5"><div className="flex items-center justify-between"><p className="font-black">AI 근거 점수</p><span className="rounded-full bg-blue-950 px-3 py-1 text-xs font-black text-blue-300">등급 {prediction.confidenceGrade}</span></div><div className="mt-4 space-y-4">{prediction.factors.map((factor)=><div key={factor.label}><div className="mb-2 flex justify-between text-xs"><span className="text-slate-400">{factor.label} · 가중치 {factor.weight}%</span><span className="font-black">{factor.away} : {factor.home}</span></div><div className="flex h-2 overflow-hidden rounded-full bg-slate-800"><div className="bg-slate-500" style={{width:`${factor.away/(factor.away+factor.home)*100}%`}}/><div className="bg-blue-600" style={{width:`${factor.home/(factor.away+factor.home)*100}%`}}/></div></div>)}</div></div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5"><p className="font-black">AI 분석 근거</p><div className="mt-3 space-y-2 text-sm leading-6 text-slate-300">{prediction.reasons.map((reason)=><p key={reason}>• {reason}</p>)}</div></div>
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-500">본 예측은 공개 경기 기록을 기반으로 한 참고용 분석이며 실제 결과를 보장하지 않습니다.</p>
    </section>
  );
}
type StarterData = {
  pitcher: TeamPitcher;
  koreanName: string;
  opponentStats: OpponentPitchingStats | null;
  currentVenueStats?: VenuePitchingStats | null;
  recent5?: RecentPitchingSummary | null;
  recent10?: RecentPitchingSummary | null;
  seasonStats?: { games:number; wins:number; losses:number; innings:string; era:number; whip:number } | null;
};

const TEAM_CODES: Record<string, string> = {
  "KIA 타이거즈": "KIA",
  "삼성 라이온즈": "SAMSUNG",
  "LG 트윈스": "LG",
  "두산 베어스": "DOOSAN",
  "KT 위즈": "KT",
  "SSG 랜더스": "SSG",
  "롯데 자이언츠": "LOTTE",
  "한화 이글스": "HANWHA",
  "NC 다이노스": "NC",
  "키움 히어로즈": "KIWOOM",
};

function formatAverage(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "-";
  }

  return value.toFixed(3).replace(/^0/, "");
}

function formatEra(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return "-";
  }

  return value.toFixed(2);
}

function normalizePitcherName(value: string) {
  return value.toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
}

function findAnnouncedStarter(
  pitchers: TeamPitcher[],
  starterName: string,
  starterCode: string,
) {
  if (!starterName && !starterCode) return undefined;

  if (starterCode) {
    const byCode = pitchers.find((pitcher) => pitcher.pcode === starterCode);
    if (byCode) return byCode;
  }

  const target = normalizePitcherName(starterName);
  if (!target) return undefined;

  return pitchers.find((pitcher) => {
    const player = normalizePitcherName(pitcher.player);
    return player === target || player.includes(target) || target.includes(player);
  });
}

function createStarterPlaceholder(
  player: string,
  teamCode: string,
  team: string,
  pcode = "",
): TeamPitcher {
  return {
    pcode, player, teamCode, team, era: -1, games: 0, completeGames: 0,
    shutouts: 0, wins: 0, losses: 0, saves: 0, holds: 0,
    winningPercentage: 0, plateAppearances: 0, pitches: 0, innings: "-",
    inningsValue: 0, hits: 0, doubles: 0, triples: 0, homeRuns: 0,
    walks: 0, hitByPitch: 0, strikeouts: 0, runs: 0, earnedRuns: 0, whip: 0,
  };
}

function TeamSeasonCard({
  title,
  teamName,
  standing,
  highlight = false,
}: {
  title: string;
  teamName: string;
  standing?: KboStanding;
  highlight?: boolean;
}) {
  return (
    <article
      className={`rounded-2xl border p-6 ${
        highlight
          ? "border-blue-800 bg-blue-950/30"
          : "border-slate-800 bg-slate-900"
      }`}
    >
      <p
        className={`text-xs font-black ${
          highlight ? "text-blue-400" : "text-slate-500"
        }`}
      >
        {title}
      </p>

      <h2 className="mt-3 text-xl font-black">{teamName}</h2>

      {!standing ? (
        <p className="mt-6 text-sm text-slate-500">
          시즌 기록을 찾지 못했습니다.
        </p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-950 p-4">
              <p className="text-xs font-bold text-slate-500">
                현재 순위
              </p>
              <p className="mt-2 text-2xl font-black">
                {standing.rank}위
              </p>
            </div>

            <div className="rounded-xl bg-slate-950 p-4">
              <p className="text-xs font-bold text-slate-500">
                승률
              </p>
              <p className="mt-2 text-2xl font-black">
                {formatAverage(standing.winningPercentage)}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3 rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">
                시즌 성적
              </span>
              <span className="font-black">
                {standing.wins}승 {standing.draws}무{" "}
                {standing.losses}패
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-sm text-slate-500">
                홈 성적
              </span>
              <span className="font-bold">
                {standing.home || "-"}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-sm text-slate-500">
                원정 성적
              </span>
              <span className="font-bold">
                {standing.away || "-"}
              </span>
            </div>
          </div>
        </>
      )}
    </article>
  );
}

function ComparisonRow({
  label,
  awayValue,
  homeValue,
}: {
  label: string;
  awayValue: string | number;
  homeValue: string | number;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-t border-slate-800 py-4 first:border-t-0">
      <p className="text-left text-lg font-black">
        {awayValue}
      </p>

      <p className="text-center text-xs font-bold text-slate-500">
        {label}
      </p>

      <p className="text-right text-lg font-black">
        {homeValue}
      </p>
    </div>
  );
}

function TeamBattingComparison({
  awayName,
  homeName,
  awayBatting,
  homeBatting,
}: {
  awayName: string;
  homeName: string;
  awayBatting?: TeamBatting;
  homeBatting?: TeamBatting;
}) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <p className="text-sm font-black text-blue-400">
        팀 타격 비교
      </p>

      <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <p className="font-black">{awayName}</p>
        <p className="text-xs font-black text-slate-600">
          VS
        </p>
        <p className="text-right font-black">{homeName}</p>
      </div>

      {!awayBatting || !homeBatting ? (
        <p className="mt-6 text-sm text-slate-500">
          팀 타격 기록을 찾지 못했습니다.
        </p>
      ) : (
        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950 px-4">
          <ComparisonRow
            label="팀 타율"
            awayValue={formatAverage(
              awayBatting.battingAverage,
            )}
            homeValue={formatAverage(
              homeBatting.battingAverage,
            )}
          />

          <ComparisonRow
            label="출루율"
            awayValue={formatAverage(
              awayBatting.onBasePercentage,
            )}
            homeValue={formatAverage(
              homeBatting.onBasePercentage,
            )}
          />

          <ComparisonRow
            label="장타율"
            awayValue={formatAverage(
              awayBatting.sluggingPercentage,
            )}
            homeValue={formatAverage(
              homeBatting.sluggingPercentage,
            )}
          />

          <ComparisonRow
            label="OPS"
            awayValue={formatAverage(awayBatting.ops)}
            homeValue={formatAverage(homeBatting.ops)}
          />

          <ComparisonRow
            label="홈런"
            awayValue={`${awayBatting.homeRuns}개`}
            homeValue={`${homeBatting.homeRuns}개`}
          />

          <ComparisonRow
            label="볼넷"
            awayValue={`${awayBatting.walks}개`}
            homeValue={`${homeBatting.walks}개`}
          />

          <ComparisonRow
            label="경기당 득점"
            awayValue={awayBatting.averageRunsPerGame.toFixed(2)}
            homeValue={homeBatting.averageRunsPerGame.toFixed(2)}
          />
        </div>
      )}
    </article>
  );
}

function StarterCard({
  teamName,
  starter,
  opponentName,
  stadium,
  highlight = false,
}: {
  teamName: string;
  starter?: StarterData;
  opponentName: string;
  stadium: string;
  highlight?: boolean;
}) {
  return (
    <article
      className={`rounded-2xl border p-6 ${
        highlight
          ? "border-blue-800 bg-blue-950/30"
          : "border-slate-800 bg-slate-900"
      }`}
    >
      <p
        className={`text-xs font-black ${
          highlight ? "text-blue-400" : "text-slate-500"
        }`}
      >
        예고 선발
      </p>

      <h3 className="mt-2 text-lg font-black">{teamName}</h3>

      {!starter ? (
        <p className="mt-6 text-sm text-slate-500">
          선발투수 정보를 찾지 못했습니다.
        </p>
      ) : (
        <>
          <div className="mt-6 flex items-end justify-between">
            <div>
              <p className="text-2xl font-black">
                {starter.koreanName}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                공식 발표 기준
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs font-bold text-slate-500">
                시즌 ERA
              </p>
              <p className="mt-1 text-3xl font-black text-blue-400">
                {formatEra(starter.pitcher.era)}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-slate-950 p-3 text-center">
              <p className="text-xs text-slate-500">승패</p>
              <p className="mt-2 font-black">{starter.pitcher.wins}승 {starter.pitcher.losses}패</p>
            </div>
            <div className="rounded-xl bg-slate-950 p-3 text-center">
              <p className="text-xs text-slate-500">시즌 이닝</p>
              <p className="mt-2 font-black">{starter.pitcher.innings}</p>
            </div>
            <div className="rounded-xl bg-slate-950 p-3 text-center">
              <p className="text-xs text-slate-500">등판 경기</p>
              <p className="mt-2 font-black">{starter.pitcher.games}경기</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <p className="text-xs text-slate-500">WHIP</p>
              <p className="mt-2 text-lg font-black">{starter.pitcher.whip > 0 ? starter.pitcher.whip.toFixed(2) : "-"}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <p className="text-xs text-slate-500">볼넷</p>
              <p className="mt-2 text-lg font-black">{starter.pitcher.walks > 0 ? `${starter.pitcher.walks}개` : "-"}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <p className="text-xs text-slate-500">탈삼진</p>
              <p className="mt-2 text-lg font-black">{starter.pitcher.strikeouts > 0 ? `${starter.pitcher.strikeouts}개` : "-"}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <p className="text-xs text-slate-500">피홈런</p>
              <p className="mt-2 text-lg font-black">{starter.pitcher.homeRuns > 0 ? `${starter.pitcher.homeRuns}개` : "-"}</p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-slate-700 bg-slate-950 p-4">
            <p className="text-sm font-black text-blue-400">
              {opponentName} 상대 성적
            </p>

            {!starter.opponentStats ? (
              <p className="mt-4 text-sm text-slate-500">
                이번 시즌 상대 기록이 없습니다.
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">경기</span>
                  <span className="font-black">
                    {starter.opponentStats.games}경기
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">이닝</span>
                  <span className="font-black">
                    {starter.opponentStats.innings}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">실점</span>
                  <span className="font-black">
                    {starter.opponentStats.runs}점
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">자책</span>
                  <span className="font-black">
                    {starter.opponentStats.earnedRuns}점
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">
                    상대 ERA
                  </span>
                  <span className="font-black">
                    {formatEra(starter.opponentStats.era)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">WHIP</span>
                  <span className="font-black">
                    {starter.opponentStats.whip.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">볼넷</span>
                  <span className="font-black">
                    {starter.opponentStats.walks}개
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">
                    탈삼진
                  </span>
                  <span className="font-black">
                    {starter.opponentStats.strikeouts}개
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
              <p className="text-sm font-black text-blue-400">최근 5경기</p>
              {starter.recent5 ? <div className="mt-3 space-y-2 text-sm"><p>{starter.recent5.games}경기 · {starter.recent5.wins}승 {starter.recent5.losses}패</p><p>ERA {formatEra(starter.recent5.era)} · WHIP {starter.recent5.whip.toFixed(2)}</p><p>QS {starter.recent5.qualityStarts}회 · {starter.recent5.innings}이닝</p></div> : <p className="mt-3 text-sm text-slate-500">최근 경기 상세 기록을 불러오지 못했습니다.</p>}
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
              <p className="text-sm font-black text-blue-400">{stadium || "오늘 구장"} 성적</p>
              {starter.currentVenueStats ? <div className="mt-3 space-y-2 text-sm"><p>{starter.currentVenueStats.games}경기 · {starter.currentVenueStats.wins}승 {starter.currentVenueStats.losses}패</p><p>승률 {(starter.currentVenueStats.winningPercentage * 100).toFixed(1)}% · ERA {formatEra(starter.currentVenueStats.era)}</p><p>WHIP {starter.currentVenueStats.whip ? starter.currentVenueStats.whip.toFixed(2) : "-"} · {starter.currentVenueStats.innings}이닝</p></div> : <p className="mt-3 text-sm text-slate-500">해당 구장 시즌 기록이 없거나 공식 표에서 확인되지 않았습니다.</p>}
            </div>
          </div>
        </>
      )}
    </article>
  );
}

function ResultBadge({
  result,
}: {
  result: TeamGame["result"];
}) {
  const className =
    result === "승"
      ? "bg-blue-600 text-white"
      : result === "패"
        ? "bg-red-600 text-white"
        : "bg-slate-600 text-white";

  return (
    <span
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${className}`}
    >
      {result}
    </span>
  );
}

function FormSummaryCard({
  title,
  teamName,
  section,
}: {
  title: string;
  teamName: string;
  section?: TeamFormSection;
}) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <p className="text-sm font-black text-blue-400">
        {title}
      </p>

      <h3 className="mt-2 text-xl font-black">{teamName}</h3>

      {!section || section.summary.games === 0 ? (
        <p className="mt-6 text-sm text-slate-500">
          완료된 경기 기록이 없습니다.
        </p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-slate-950 p-4 text-center">
              <p className="text-xs text-slate-500">승</p>
              <p className="mt-2 text-2xl font-black text-blue-400">
                {section.summary.wins}
              </p>
            </div>

            <div className="rounded-xl bg-slate-950 p-4 text-center">
              <p className="text-xs text-slate-500">패</p>
              <p className="mt-2 text-2xl font-black text-red-400">
                {section.summary.losses}
              </p>
            </div>

            <div className="rounded-xl bg-slate-950 p-4 text-center">
              <p className="text-xs text-slate-500">무</p>
              <p className="mt-2 text-2xl font-black">
                {section.summary.draws}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-xs text-slate-500">
                경기당 평균 득점
              </p>
              <p className="mt-2 text-xl font-black">
                {section.summary.averageRunsScored.toFixed(2)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-xs text-slate-500">
                경기당 평균 실점
              </p>
              <p className="mt-2 text-xl font-black">
                {section.summary.averageRunsAllowed.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {section.games.map((game, index) => (
              <ResultBadge
                key={`${game.date}-${game.opponent}-${index}`}
                result={game.result}
              />
            ))}
          </div>
        </>
      )}
    </article>
  );
}

function GameHistoryList({
  title,
  games,
}: {
  title: string;
  games: TeamGame[];
}) {
  const compact = title.includes("맞대결");
  const visibleGames = compact ? games.slice(0, 8) : games;

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black text-blue-400">경기 결과</p>
          <h3 className="mt-1 text-lg font-black">{title}</h3>
        </div>
        {compact && games.length > 0 && (
          <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-bold text-slate-400">
            최근 {visibleGames.length}경기
          </span>
        )}
      </div>

      {games.length === 0 ? (
        <p className="mt-5 text-sm text-slate-500">경기 기록이 없습니다.</p>
      ) : compact ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {visibleGames.map((game, index) => (
            <div
              key={`${game.date}-${game.opponent}-${index}`}
              className="rounded-xl border border-slate-800 bg-slate-950 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <ResultBadge result={game.result} />
                  <div className="min-w-0">
                    <p className="truncate font-black">{game.location} · {game.opponent}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {game.date}{game.stadium ? ` · ${game.stadium}` : ""}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xl font-black tracking-tight">
                    {game.teamScore}<span className="mx-1 text-slate-600">:</span>{game.opponentScore}
                  </p>
                  <p className="mt-1 text-[11px] font-bold text-slate-500">{game.result === "승" ? "승리" : game.result === "패" ? "패배" : "무승부"}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {visibleGames.map((game, index) => (
            <div
              key={`${game.date}-${game.opponent}-${index}`}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-xl border border-slate-800 bg-slate-950 p-4"
            >
              <ResultBadge result={game.result} />
              <div>
                <p className="font-black">{game.location} · {game.opponent}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {game.date}{game.stadium ? ` · ${game.stadium}` : ""}
                </p>
              </div>
              <p className="text-lg font-black">{game.teamScore} : {game.opponentScore}</p>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function HeadToHeadComparison({
  awayName,
  homeName,
  awaySection,
  homeSection,
}: {
  awayName: string;
  homeName: string;
  awaySection?: TeamFormSection;
  homeSection?: TeamFormSection;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <p className="text-sm font-black text-blue-400">
        이번 시즌 상대전적
      </p>

      <div className="mt-3 text-center text-xs font-bold text-slate-500">
        시즌 완료 경기 {awaySection?.summary.games ?? 0}경기 · 무승부 {awaySection?.summary.draws ?? 0}경기
      </div>

      <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-center">
        <div>
          <p className="text-sm text-slate-500">{awayName}</p>
          <p className="mt-2 text-4xl font-black">
            {awaySection?.summary.wins ?? 0}승 {awaySection?.summary.losses ?? 0}패
          </p>
          {(awaySection?.summary.draws ?? 0) > 0 && (
            <p className="mt-1 text-sm font-bold text-slate-500">
              {awaySection?.summary.draws ?? 0}무
            </p>
          )}
        </div>

        <span className="text-sm font-black text-slate-600">
          VS
        </span>

        <div>
          <p className="text-sm text-slate-500">{homeName}</p>
          <p className="mt-2 text-4xl font-black">
            {homeSection?.summary.wins ?? 0}승 {homeSection?.summary.losses ?? 0}패
          </p>
          {(homeSection?.summary.draws ?? 0) > 0 && (
            <p className="mt-1 text-sm font-bold text-slate-500">
              {homeSection?.summary.draws ?? 0}무
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-950 p-4 text-center">
          <p className="text-xs text-slate-500">
            {awayName} 평균 득점
          </p>
          <p className="mt-2 text-xl font-black">
            {(awaySection?.summary.averageRunsScored ?? 0).toFixed(
              2,
            )}
          </p>
        </div>

        <div className="rounded-xl bg-slate-950 p-4 text-center">
          <p className="text-xs text-slate-500">
            {homeName} 평균 득점
          </p>
          <p className="mt-2 text-xl font-black">
            {(homeSection?.summary.averageRunsScored ?? 0).toFixed(
              2,
            )}
          </p>
        </div>
      </div>
    </section>
  );
}

function GameDetailContent() {
  const searchParams = useSearchParams();

  const league = searchParams.get("league") ?? "KBO";
  const date = searchParams.get("date") ?? "";
  const time = searchParams.get("time") ?? "";
  const away = searchParams.get("away") ?? "원정팀";
  const home = searchParams.get("home") ?? "홈팀";
  const stadium = searchParams.get("stadium") ?? "";
  const awayStarterName = searchParams.get("awayStarter") ?? "";
  const homeStarterName = searchParams.get("homeStarter") ?? "";
  const awayStarterCode = searchParams.get("awayStarterCode") ?? "";
  const homeStarterCode = searchParams.get("homeStarterCode") ?? "";

  const [standings, setStandings] = useState<KboStanding[]>([]);
  const [batting, setBatting] = useState<TeamBatting[]>([]);
  const [awayStarter, setAwayStarter] =
    useState<StarterData | undefined>();
  const [homeStarter, setHomeStarter] =
    useState<StarterData | undefined>();

  const [awayForm, setAwayForm] =
    useState<TeamFormResponse | null>(null);
  const [homeForm, setHomeForm] =
    useState<TeamFormResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      try {
        setLoading(true);
        setErrorMessage("");

        const awayCode = TEAM_CODES[away];
        const homeCode = TEAM_CODES[home];

        if (!awayCode || !homeCode) {
          throw new Error("팀 코드를 찾지 못했습니다.");
        }

        const [
          standingsResponse,
          battingResponse,
          awayPitchingResponse,
          homePitchingResponse,
          awayFormResponse,
          homeFormResponse,
        ] = await Promise.all([
          fetch("/api/kbo/standings", {
            cache: "no-store",
            signal: controller.signal,
          }),

          fetch("/api/kbo/team-batting", {
            cache: "no-store",
            signal: controller.signal,
          }),

          fetch(
            `/api/kbo/team-pitching?team=${encodeURIComponent(
              awayCode,
            )}`,
            {
              cache: "no-store",
              signal: controller.signal,
            },
          ),

          fetch(
            `/api/kbo/team-pitching?team=${encodeURIComponent(
              homeCode,
            )}`,
            {
              cache: "no-store",
              signal: controller.signal,
            },
          ),

          fetch(
            `/api/kbo/team-form?team=${encodeURIComponent(
              awayCode,
            )}&opponent=${encodeURIComponent(
              homeCode,
            )}&date=${encodeURIComponent(date)}`,
            {
              cache: "no-store",
              signal: controller.signal,
            },
          ),

          fetch(
            `/api/kbo/team-form?team=${encodeURIComponent(
              homeCode,
            )}&opponent=${encodeURIComponent(
              awayCode,
            )}&date=${encodeURIComponent(date)}`,
            {
              cache: "no-store",
              signal: controller.signal,
            },
          ),
        ]);

        const standingsData =
          (await standingsResponse.json()) as StandingsResponse;

        const battingData =
          (await battingResponse.json()) as BattingResponse;

        const awayPitchingData =
          (await awayPitchingResponse.json()) as PitchingResponse;

        const homePitchingData =
          (await homePitchingResponse.json()) as PitchingResponse;

        const awayFormData =
          (await awayFormResponse.json()) as TeamFormResponse;

        const homeFormData =
          (await homeFormResponse.json()) as TeamFormResponse;

        if (!standingsResponse.ok || !standingsData.success) {
          throw new Error(
            standingsData.message ??
              "팀 순위를 불러오지 못했습니다.",
          );
        }

        if (!battingResponse.ok || !battingData.success) {
          throw new Error(
            battingData.message ??
              "팀 타격 기록을 불러오지 못했습니다.",
          );
        }

        // 투수 시즌 기록 API가 일시적으로 실패해도
        // 순위·타격·최근 경기·맞대결 분석 화면은 계속 표시합니다.
        const awayPitchers =
          awayPitchingResponse.ok && awayPitchingData.success
            ? awayPitchingData.pitchers ?? []
            : [];

        const homePitchers =
          homePitchingResponse.ok && homePitchingData.success
            ? homePitchingData.pitchers ?? []
            : [];

        if (!awayFormResponse.ok || !awayFormData.success) {
          throw new Error(
            awayFormData.message ??
              "원정팀 최근 경기 기록을 불러오지 못했습니다.",
          );
        }

        if (!homeFormResponse.ok || !homeFormData.success) {
          throw new Error(
            homeFormData.message ??
              "홈팀 최근 경기 기록을 불러오지 못했습니다.",
          );
        }

        const matchedAwayPitcher = findAnnouncedStarter(
          awayPitchers,
          awayStarterName,
          awayStarterCode,
        );

        const matchedHomePitcher = findAnnouncedStarter(
          homePitchers,
          homeStarterName,
          homeStarterCode,
        );

        const awayPitcher = awayStarterName
          ? matchedAwayPitcher ??
            createStarterPlaceholder(awayStarterName, awayCode, away, awayStarterCode)
          : undefined;

        const homePitcher = homeStarterName
          ? matchedHomePitcher ??
            createStarterPlaceholder(homeStarterName, homeCode, home, homeStarterCode)
          : undefined;

        const opponentRequests: Promise<Response>[] = [];

        if (awayPitcher) {
          opponentRequests.push(fetch(`/api/kbo/pitcher-vs-team?pcode=${encodeURIComponent(awayPitcher.pcode || "")}&name=${encodeURIComponent(awayStarterName || awayPitcher.player)}&opponent=${encodeURIComponent(homeCode)}&stadium=${encodeURIComponent(stadium)}&team=${encodeURIComponent(awayCode)}`, { cache:"no-store", signal:controller.signal }));
        }
        if (homePitcher) {
          opponentRequests.push(fetch(`/api/kbo/pitcher-vs-team?pcode=${encodeURIComponent(homePitcher.pcode || "")}&name=${encodeURIComponent(homeStarterName || homePitcher.player)}&opponent=${encodeURIComponent(awayCode)}&stadium=${encodeURIComponent(stadium)}&team=${encodeURIComponent(homeCode)}`, { cache:"no-store", signal:controller.signal }));
        }

        const opponentResponses =
          await Promise.all(opponentRequests);

        let responseIndex = 0;

        if (awayPitcher) {
          let data: PitcherVsTeamResponse | null = null;
          const response = opponentResponses[responseIndex];
          responseIndex += 1;
          if (response?.ok) data = (await response.json()) as PitcherVsTeamResponse;
          const awaySeason = data?.seasonStats;
          setAwayStarter({
            pitcher: awaySeason ? { ...awayPitcher, games: awaySeason.games, wins: awaySeason.wins, losses: awaySeason.losses, innings: awaySeason.innings, inningsValue: Number.parseFloat(awaySeason.innings) || awayPitcher.inningsValue, era: awaySeason.era } : awayPitcher,
            koreanName: awayStarterName || data?.playerName || awayPitcher.player,
            opponentStats: data?.found ? data.stats : null,
            currentVenueStats: data?.currentVenueStats ?? null,
            recent5: data?.recent5 ?? null,
            recent10: data?.recent10 ?? null,
          });
        } else {
          setAwayStarter(undefined);
        }

        if (homePitcher) {
          let data: PitcherVsTeamResponse | null = null;
          const response = opponentResponses[responseIndex];
          if (response?.ok) data = (await response.json()) as PitcherVsTeamResponse;
          const homeSeason = data?.seasonStats;
          setHomeStarter({
            pitcher: homeSeason ? { ...homePitcher, games: homeSeason.games, wins: homeSeason.wins, losses: homeSeason.losses, innings: homeSeason.innings, inningsValue: Number.parseFloat(homeSeason.innings) || homePitcher.inningsValue, era: homeSeason.era } : homePitcher,
            koreanName: homeStarterName || data?.playerName || homePitcher.player,
            opponentStats: data?.found ? data.stats : null,
            currentVenueStats: data?.currentVenueStats ?? null,
            recent5: data?.recent5 ?? null,
            recent10: data?.recent10 ?? null,
          });
        } else {
          setHomeStarter(undefined);
        }

        setStandings(standingsData.standings ?? []);
        setBatting(battingData.batting ?? []);
        setAwayForm(awayFormData);
        setHomeForm(homeFormData);
      } catch (error) {
        if (
          error instanceof Error &&
          error.name === "AbortError"
        ) {
          return;
        }

        console.warn("경기 상세 데이터 오류:", error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "경기 데이터를 불러오지 못했습니다.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => controller.abort();
  }, [away, home, date]);

  const awayStanding = standings.find(
    (item) => item.team === away,
  );

  const homeStanding = standings.find(
    (item) => item.team === home,
  );

  const awayBatting = batting.find(
    (item) => item.team === away,
  );

  const homeBatting = batting.find(
    (item) => item.team === home,
  );

  const prediction = makePrediction({
    awayName: away, homeName: home, awayStanding, homeStanding, awayBatting, homeBatting,
    awayStarter, homeStarter, awayForm, homeForm,
  });

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <Link href="/" className="text-2xl font-black">
            Sports AI
          </Link>

          <span className="rounded-full bg-blue-600 px-4 py-2 text-xs font-black">
            {league}
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-10">
        <Link
          href="/"
          className="text-sm font-bold text-slate-400 hover:text-white"
        >
          ← 경기 목록으로
        </Link>

        <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-6 md:p-10">
          <div className="text-center">
            <p className="text-sm font-black text-blue-400">
              {date}
            </p>

            <p className="mt-2 text-sm text-slate-400">
              {time}
              {stadium ? ` · ${stadium}` : ""}
            </p>
          </div>

          <div className="mt-10 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div className="text-center">
              <p className="text-xs font-bold text-slate-500">
                원정팀
              </p>
              <h1 className="mt-3 text-xl font-black md:text-3xl">
                {away}
              </h1>
            </div>

            <div className="rounded-full border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-black text-slate-500">
              VS
            </div>

            <div className="text-center">
              <p className="text-xs font-bold text-blue-400">
                홈팀
              </p>
              <h2 className="mt-3 text-xl font-black md:text-3xl">
                {home}
              </h2>
            </div>
          </div>
        </div>

        {loading && (
          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center text-slate-400">
            경기 데이터를 불러오는 중입니다.
          </div>
        )}

        {!loading && errorMessage && (
          <div className="mt-8 rounded-2xl border border-red-900 bg-red-950/40 p-8 text-center text-red-300">
            {errorMessage}
          </div>
        )}

        {!loading && !errorMessage && (
          <>
            <section className="mt-8 grid gap-5 md:grid-cols-2">
              <TeamSeasonCard
                title="원정팀 시즌 기록"
                teamName={away}
                standing={awayStanding}
              />

              <TeamSeasonCard
                title="홈팀 시즌 기록"
                teamName={home}
                standing={homeStanding}
                highlight
              />
            </section>

            <section className="mt-8">
              <TeamBattingComparison
                awayName={away}
                homeName={home}
                awayBatting={awayBatting}
                homeBatting={homeBatting}
              />
            </section>

            <section className="mt-8">
              <h2 className="mb-5 text-2xl font-black">
                선발투수 비교
              </h2>

              <div className="grid gap-5 md:grid-cols-2">
                <StarterCard
                  teamName={away}
                  starter={awayStarter}
                  opponentName={home}
                  stadium={stadium}
                />

                <StarterCard
                  teamName={home}
                  starter={homeStarter}
                  opponentName={away}
                  stadium={stadium}
                  highlight
                />
              </div>
            </section>

            <section className="mt-10">
              <h2 className="text-2xl font-black">
                최근 경기 흐름
              </h2>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <FormSummaryCard
                  title="최근 10경기"
                  teamName={away}
                  section={awayForm?.recent10}
                />

                <FormSummaryCard
                  title="최근 10경기"
                  teamName={home}
                  section={homeForm?.recent10}
                />
              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <GameHistoryList
                  title={`${away} 최근 경기`}
                  games={awayForm?.recent10.games ?? []}
                />

                <GameHistoryList
                  title={`${home} 최근 경기`}
                  games={homeForm?.recent10.games ?? []}
                />
              </div>
            </section>

            <section className="mt-10">
              <h2 className="text-2xl font-black">
                팀 상대전적
              </h2>

              <div className="mt-5">
                <HeadToHeadComparison
                  awayName={away}
                  homeName={home}
                  awaySection={awayForm?.headToHead}
                  homeSection={homeForm?.headToHead}
                />
              </div>

              <div className="mt-5">
                <GameHistoryList
                  title={`${away} 기준 맞대결 결과`}
                  games={awayForm?.headToHead.games ?? []}
                />
              </div>
            </section>
          </>
        )}


        {!loading && !errorMessage && (
          <AdvancedAnalysisSection prediction={prediction} away={away} home={home} awayForm={awayForm} homeForm={homeForm} date={date} />
        )}

        {!loading && !errorMessage && (
          <PredictionSection prediction={prediction} away={away} home={home} />
        )}
      </section>
    </main>
  );
}

export default function GamePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
          경기 정보를 불러오는 중입니다.
        </main>
      }
    >
      <GameDetailContent />
    </Suspense>
  );
}
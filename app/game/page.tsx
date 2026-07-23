"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { dataCacheUrl } from "../lib/client-data-cache";
import { savePregamePrediction } from "../lib/prediction-history";

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

type SplitPitchingStats = {
  label: string;
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

type VenuePitchingStats = SplitPitchingStats & {
  venue: string;
};

type PitchingSplits = {
  venue: VenuePitchingStats[];
  month: SplitPitchingStats[];
  weekday: SplitPitchingStats[];
  homeAway: SplitPitchingStats[];
  dayNight: SplitPitchingStats[];
  period: SplitPitchingStats[];
};
type RecentPitchingSummary = {
  games: number;
  wins: number;
  losses: number;
  innings: string;
  era: number;
  whip: number;
  qualityStarts: number;
};

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
  splits?: PitchingSplits;
  currentMonthStats?: SplitPitchingStats | null;
  currentWeekdayStats?: SplitPitchingStats | null;
  currentHomeAwayStats?: SplitPitchingStats | null;
  currentDayNightStats?: SplitPitchingStats | null;
  recent5?: RecentPitchingSummary | null;
  recent10?: RecentPitchingSummary | null;
  seasonStats?: {
    games: number;
    wins: number;
    losses: number;
    innings: string;
    era: number;
    whip: number;
    walks?: number;
    strikeouts?: number;
    homeRuns?: number;
  } | null;
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
  expectedTotal: number;
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
  awayName,
  homeName,
  awayStanding,
  homeStanding,
  awayBatting,
  homeBatting,
  awayStarter,
  homeStarter,
  awayForm,
  homeForm,
}: {
  awayName: string;
  homeName: string;
  awayStanding?: KboStanding;
  homeStanding?: KboStanding;
  awayBatting?: TeamBatting;
  homeBatting?: TeamBatting;
  awayStarter?: StarterData;
  homeStarter?: StarterData;
  awayForm: TeamFormResponse | null;
  homeForm: TeamFormResponse | null;
}): Prediction {
  const awaySeason = safe(awayStanding?.winningPercentage, 0.5);
  const homeSeason = safe(homeStanding?.winningPercentage, 0.5);
  const awayRecentGames = safe(awayForm?.recent10.summary.games);
  const homeRecentGames = safe(homeForm?.recent10.summary.games);
  const awayRecent = awayRecentGames
    ? safe(awayForm?.recent10.summary.wins) / awayRecentGames
    : 0.5;
  const homeRecent = homeRecentGames
    ? safe(homeForm?.recent10.summary.wins) / homeRecentGames
    : 0.5;
  const awayOps = safe(awayBatting?.ops, 0.7);
  const homeOps = safe(homeBatting?.ops, 0.7);
  const awayEra =
    awayStarter && awayStarter.pitcher.era >= 0 ? awayStarter.pitcher.era : 4.5;
  const homeEra =
    homeStarter && homeStarter.pitcher.era >= 0 ? homeStarter.pitcher.era : 4.5;
  const awayVsEra = awayStarter?.opponentStats?.era ?? awayEra;
  const homeVsEra = homeStarter?.opponentStats?.era ?? homeEra;
  const awayH2H = awayForm?.headToHead.summary;
  const homeH2H = homeForm?.headToHead.summary;
  const h2hGames = safe(awayH2H?.games);
  const awayH2HRate = h2hGames ? safe(awayH2H?.wins) / h2hGames : 0.5;
  const homeH2HRate = h2hGames ? safe(homeH2H?.wins) / h2hGames : 0.5;
  const awayRunDiff =
    safe(awayForm?.recent10.summary.averageRunsScored) -
    safe(awayForm?.recent10.summary.averageRunsAllowed);
  const homeRunDiff =
    safe(homeForm?.recent10.summary.averageRunsScored) -
    safe(homeForm?.recent10.summary.averageRunsAllowed);

  let homeEdge = 0.028; // 기본 홈 이점
  homeEdge += (homeSeason - awaySeason) * 0.25;
  homeEdge += (homeRecent - awayRecent) * 0.18;
  homeEdge += (homeOps - awayOps) * 0.26;
  homeEdge += (awayVsEra - homeVsEra) * 0.017;
  homeEdge += (homeRunDiff - awayRunDiff) * 0.018;
  if (h2hGames >= 4) homeEdge += (homeH2HRate - awayH2HRate) * 0.08;

  const homeProb = clamp(0.5 + homeEdge, 0.24, 0.76);
  const awayProb = 1 - homeProb;

  const leagueBase = 4.45;
  const awayRecentRuns = awayRecentGames
    ? safe(awayForm?.recent10.summary.averageRunsScored, leagueBase)
    : safe(awayBatting?.averageRunsPerGame, leagueBase);
  const homeRecentRuns = homeRecentGames
    ? safe(homeForm?.recent10.summary.averageRunsScored, leagueBase)
    : safe(homeBatting?.averageRunsPerGame, leagueBase);
  const awayScoreRaw =
    awayRecentRuns * 0.5 +
    leagueBase * 0.28 +
    (5.0 - homeVsEra) * 0.16 +
    Math.max(-0.4, awayRunDiff * 0.08);
  const homeScoreRaw =
    homeRecentRuns * 0.5 +
    leagueBase * 0.28 +
    (5.0 - awayVsEra) * 0.16 +
    Math.max(-0.4, homeRunDiff * 0.08) +
    0.15;
  const winner = homeProb >= awayProb ? homeName : awayName;

  // 반올림 전 예상 득점 합계는 언더/오버 판단용으로 따로 보존합니다.
  // 표시 스코어의 점수 차는 승률 차와 원래 득점 차를 함께 반영합니다.
  const expectedTotal = Math.round((awayScoreRaw + homeScoreRaw) * 10) / 10;
  const probabilityGap = Math.abs(homeProb - awayProb);
  const rawScoreGap = Math.abs(homeScoreRaw - awayScoreRaw);
  const targetMargin = clamp(
    Math.round(probabilityGap * 10 + rawScoreGap * 0.55),
    1,
    5,
  );
  const displayedTotal = clamp(Math.round(expectedTotal), 3, 20);

  let winnerScore = Math.round((displayedTotal + targetMargin) / 2);
  let loserScore = displayedTotal - winnerScore;

  if (loserScore < 1) {
    loserScore = 1;
    winnerScore = Math.min(10, Math.max(2, displayedTotal - loserScore));
  }

  winnerScore = clamp(winnerScore, 2, 10);
  loserScore = clamp(loserScore, 1, 9);

  let awayScore = winner === awayName ? winnerScore : loserScore;
  let homeScore = winner === homeName ? winnerScore : loserScore;

  // 반올림 과정에서 추천 팀이 뒤집히는 경우만 최소한으로 보정합니다.
  if (winner === homeName && homeScore <= awayScore) {
    homeScore = Math.min(10, awayScore + 1);
  } else if (winner === awayName && awayScore <= homeScore) {
    awayScore = Math.min(10, homeScore + 1);
  }

  const totalLine = 0;
  const totalPick = expectedTotal >= 9 ? "오버" : "언더";

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
  const agreement = signals.length
    ? Math.max(homeSignals, awaySignals) / signals.length
    : 0.5;
  const dataCoverage =
    [
      awayStanding,
      homeStanding,
      awayBatting,
      homeBatting,
      awayStarter,
      homeStarter,
      awayForm,
      homeForm,
    ].filter(Boolean).length / 8;
  const confidence = Math.round(
    clamp(
      52 + agreement * 20 + dataCoverage * 13 + Math.abs(homeProb - 0.5) * 30,
      50,
      88,
    ),
  );

  const favorite = homeProb >= awayProb ? homeName : awayName;
  const underdog = favorite === homeName ? awayName : homeName;
  const favoriteProb = Math.max(homeProb, awayProb) * 100;
  const reasons: string[] = [];

  const seasonLeader = homeSeason >= awaySeason ? homeName : awayName;
  const recentLeader = homeRecent >= awayRecent ? homeName : awayName;
  const offenseLeader = homeOps >= awayOps ? homeName : awayName;
  const starterLeader = homeVsEra <= awayVsEra ? homeName : awayName;
  const runDiffLeader = homeRunDiff >= awayRunDiff ? homeName : awayName;

  reasons.push(
    `${favorite}를 우세로 보지만 예상 승률은 ${favoriteProb.toFixed(0)}% 수준으로, 무조건적인 강추천 구간은 아닙니다.`,
  );

  if (seasonLeader === recentLeader && recentLeader === offenseLeader) {
    reasons.push(
      `${seasonLeader}는 시즌 승률·최근 흐름·팀 OPS가 같은 방향을 가리켜 기본 전력 신호가 일치합니다.`,
    );
  } else {
    reasons.push(
      `시즌 승률은 ${seasonLeader}, 최근 흐름은 ${recentLeader}, 공격 지표는 ${offenseLeader}가 앞서 신호가 엇갈립니다. 한 지표만 보고 접근하기 어려운 경기입니다.`,
    );
  }

  if (starterLeader === runDiffLeader) {
    reasons.push(
      `${starterLeader}는 선발의 상대팀 성적과 최근 득실점 마진이 함께 우세해 경기 초반부터 중반까지 주도권을 잡을 가능성이 있습니다.`,
    );
  } else {
    reasons.push(
      `선발 매치업은 ${starterLeader}가 낫지만 최근 팀 득실점 흐름은 ${runDiffLeader}가 우세해, 선발 교체 이후 흐름이 바뀔 위험이 있습니다.`,
    );
  }

  if (h2hGames >= 4) {
    const h2hLeader = awayH2HRate >= homeH2HRate ? awayName : homeName;
    reasons.push(
      `이번 시즌 맞대결 ${h2hGames}경기에서는 ${h2hLeader}가 더 높은 승률을 기록했습니다. 다만 맞대결은 현재 선발 상태와 최근 팀 흐름보다 낮은 비중으로 반영했습니다.`,
    );
  } else {
    reasons.push(
      `시즌 맞대결 표본이 ${h2hGames}경기로 적어 상대전적은 핵심 근거가 아니라 보조 지표로만 반영했습니다.`,
    );
  }

  reasons.push(
    `화면에 표시된 예상 스코어의 합계는 ${awayScore + homeScore}점입니다. 실제 언더오버 추천은 내부 예상치와 시장 기준점을 비교해 최소 1점 이상 차이가 날 때만 판단합니다.`,
  );
  if (agreement < 0.67)
    reasons.push(
      `${underdog} 쪽 우세 신호도 남아 있어 배당과 AI 확률 차이가 충분하지 않으면 관망이 합리적입니다.`,
    );

  const factors = [
    {
      label: "시즌 전력",
      away: clamp(Math.round(awaySeason * 100), 20, 90),
      home: clamp(Math.round(homeSeason * 100), 20, 90),
      weight: 18,
    },
    {
      label: "최근 흐름",
      away: clamp(Math.round(awayRecent * 100), 20, 90),
      home: clamp(Math.round(homeRecent * 100), 20, 90),
      weight: 16,
    },
    {
      label: "공격력",
      away: clamp(Math.round(50 + (awayOps - 0.72) * 160), 20, 90),
      home: clamp(Math.round(50 + (homeOps - 0.72) * 160), 20, 90),
      weight: 17,
    },
    {
      label: "선발 매치업",
      away: clamp(Math.round(82 - awayVsEra * 8), 20, 90),
      home: clamp(Math.round(82 - homeVsEra * 8), 20, 90),
      weight: 22,
    },
    {
      label: "최근 득실점",
      away: clamp(Math.round(50 + awayRunDiff * 8), 20, 90),
      home: clamp(Math.round(50 + homeRunDiff * 8), 20, 90),
      weight: 15,
    },
    {
      label: "맞대결",
      away: clamp(Math.round(awayH2HRate * 100), 25, 75),
      home: clamp(Math.round(homeH2HRate * 100), 25, 75),
      weight: 7,
    },
    { label: "홈 이점", away: 45, home: 58, weight: 5 },
  ];
  const confidenceGrade: "A" | "B" | "C" =
    confidence >= 80 ? "A" : confidence >= 68 ? "B" : "C";

  return {
    awayWinProbability: Math.round(awayProb * 100),
    homeWinProbability: Math.round(homeProb * 100),
    awayScore,
    homeScore,
    totalLine,
    totalPick,
    expectedTotal,
    winner,
    confidence,
    confidenceGrade,
    factors,
    reasons,
  };
}

type BetmanMarketResponse = {
  success: boolean;
  status: "received" | "unavailable" | "error";
  gmTs?: number;
  message?: string;
  market: {
    moneyline: { away: number; home: number; draw?: number } | null;
    handicap: {
      line: number;
      away: number;
      home: number;
      draw?: number;
    } | null;
    total: { line: number; under: number; over: number } | null;
    history: {
      moneyline: Array<{ at: string; away?: number; home?: number }>;
      handicap: Array<{
        at: string;
        away?: number;
        home?: number;
        line?: number;
      }>;
      total: Array<{
        at: string;
        under?: number;
        over?: number;
        line?: number;
      }>;
    };
  } | null;
};

function AdvancedAnalysisSection({
  prediction,
  away,
  home,
  awayForm,
  homeForm,
  date,
}: {
  prediction: Prediction;
  away: string;
  home: string;
  awayForm: TeamFormResponse | null;
  homeForm: TeamFormResponse | null;
  date: string;
}) {
  const [betman, setBetman] = useState<BetmanMarketResponse | null>(null);
  const [marketLoading, setMarketLoading] = useState(true);
  const [sameOdds, setSameOdds] = useState<{
    away: {
      team: string;
      odds: number;
      games: number;
      wins: number;
      losses: number;
      rate: number;
      range: string;
    };
    home: {
      team: string;
      odds: number;
      games: number;
      wins: number;
      losses: number;
      rate: number;
      range: string;
    };
  } | null>(null);

  useEffect(() => {
    let active = true;
    setMarketLoading(true);
    fetch(
      dataCacheUrl(`/api/betman?date=${encodeURIComponent(date)}&away=${encodeURIComponent(away)}&home=${encodeURIComponent(home)}`, 600),
      { cache: "no-store" },
    )
      .then((r) => r.json())
      .then((data) => {
        if (active) setBetman(data);
      })
      .catch((error) => {
        if (active)
          setBetman({
            success: false,
            status: "error",
            market: null,
            message: error instanceof Error ? error.message : "배당 수신 실패",
          });
      })
      .finally(() => {
        if (active) setMarketLoading(false);
      });
    return () => {
      active = false;
    };
  }, [date, away, home]);

  useEffect(() => {
    const market = betman?.market?.moneyline;
    if (!market || typeof window === "undefined") return;
    const key = "sports-ai-kbo-odds-history-v1";
    const raw = window.localStorage.getItem(key);
    const rows: Array<{
      date: string;
      team: string;
      odds: number;
      result?: "승" | "패";
    }> = raw ? JSON.parse(raw) : [];
    const candidates = [
      { team: away, odds: market.away, form: awayForm },
      { team: home, odds: market.home, form: homeForm },
    ];
    for (const item of candidates) {
      if (!rows.some((row) => row.date === date && row.team === item.team))
        rows.push({ date, team: item.team, odds: item.odds });
      for (const row of rows.filter(
        (row) => row.team === item.team && !row.result,
      )) {
        const game = item.form?.recent10.games.find((g) => g.date === row.date);
        if (game && game.result !== "무") row.result = game.result;
      }
    }
    window.localStorage.setItem(key, JSON.stringify(rows.slice(-1000)));
    const makeStats = (team: string, odds: number) => {
      const low = odds - 0.05;
      const high = odds + 0.05;
      const sample = rows.filter(
        (row) =>
          row.team === team &&
          row.odds >= low &&
          row.odds <= high &&
          row.result,
      );
      const wins = sample.filter((row) => row.result === "승").length;
      return {
        team,
        odds,
        games: sample.length,
        wins,
        losses: sample.length - wins,
        rate: sample.length ? (wins / sample.length) * 100 : 0,
        range: `${low.toFixed(2)}~${high.toFixed(2)}`,
      };
    };

    setSameOdds({
      away: makeStats(away, market.away),
      home: makeStats(home, market.home),
    });
  }, [betman, date, away, home, awayForm, homeForm]);

  const moneyline = betman?.market?.moneyline;
  const total = betman?.market?.total;
  const a = moneyline?.away ?? 0,
    h = moneyline?.home ?? 0;
  const marketAway = a > 1 && h > 1 ? (1 / a / (1 / a + 1 / h)) * 100 : null;
  const marketHome = marketAway == null ? null : 100 - marketAway;
  const awayGap =
    marketAway == null ? null : prediction.awayWinProbability - marketAway;
  const homeGap =
    marketHome == null ? null : prediction.homeWinProbability - marketHome;
  const predictedTotal = prediction.expectedTotal;
  const displayedPredictedTotal = prediction.awayScore + prediction.homeScore;
  const totalPick = total
    ? predictedTotal >= total.line + 1
      ? "오버"
      : predictedTotal <= total.line - 1
        ? "언더"
        : "패스"
    : null;
  const bestGap =
    awayGap == null || homeGap == null ? null : Math.max(awayGap, homeGap);
  const aiTeam =
    awayGap == null || homeGap == null
      ? null
      : awayGap >= homeGap
        ? away
        : home;
  const weekdayAway = awayForm?.weekday?.summary,
    weekdayHome = homeForm?.weekday?.summary;
  const rawWeekdayLabel =
    awayForm?.weekday?.label || homeForm?.weekday?.label || "해당 요일";
  const weekdayNameMap: Record<string, string> = {
    월: "월요일",
    화: "화요일",
    수: "수요일",
    목: "목요일",
    금: "금요일",
    토: "토요일",
    일: "일요일",
    월요일: "월요일",
    화요일: "화요일",
    수요일: "수요일",
    목요일: "목요일",
    금요일: "금요일",
    토요일: "토요일",
    일요일: "일요일",
  };
  const weekdayLabel = weekdayNameMap[rawWeekdayLabel] || rawWeekdayLabel;
  const awayWeekRate = weekdayAway?.games
    ? (weekdayAway.wins / weekdayAway.games) * 100
    : null;
  const homeWeekRate = weekdayHome?.games
    ? (weekdayHome.wins / weekdayHome.games) * 100
    : null;
  const selectedAiRate =
    aiTeam === away
      ? prediction.awayWinProbability
      : aiTeam === home
        ? prediction.homeWinProbability
        : null;
  const selectedMarketRate =
    aiTeam === away ? marketAway : aiTeam === home ? marketHome : null;
  const marketSentence =
    bestGap == null ||
    aiTeam == null ||
    selectedAiRate == null ||
    selectedMarketRate == null
      ? "현재 배당 정보를 불러오지 못해 AI 예상 승률과 배당을 비교하지 않았습니다."
      : `현재 배당은 ${aiTeam}의 승리 가능성을 약 ${selectedMarketRate.toFixed(1)}%로 보고 있습니다. SPORTS AI는 ${selectedAiRate.toFixed(1)}%로 분석했습니다. AI가 배당보다 약 ${Math.abs(bestGap).toFixed(1)}% 더 높게 평가해 ${aiTeam} 승 쪽을 우선 검토했습니다.`;
  const weekdaySentence =
    awayWeekRate == null || homeWeekRate == null
      ? `${weekdayLabel} 경기 표본이 부족해 핵심 근거에서는 제외했습니다.`
      : `${weekdayLabel} 승률은 ${away} ${awayWeekRate.toFixed(1)}%, ${home} ${homeWeekRate.toFixed(1)}%입니다.`;

  return (
    <section className="mt-10 space-y-6">
      <div className="rounded-3xl border border-amber-800/60 bg-amber-950/20 p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-amber-400">
              BETMAN LIVE MARKET
            </p>
            <h2 className="mt-2 text-2xl font-black">
              베트맨 배당 · AI 확률 비교
            </h2>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-bold ${marketLoading ? "border-slate-700 text-slate-400" : betman?.status === "received" ? "border-emerald-700 text-emerald-300" : "border-amber-700 text-amber-300"}`}
          >
            {marketLoading
              ? "불러오는 중"
              : betman?.status === "received"
                ? `자동 수신 완료 · ${betman.gmTs ?? ""}`
                : "배당 미수신"}
          </span>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          현재 배당이 나타내는 승률과 SPORTS AI 예상 승률을 전문가 분석 근거와
          함께 비교합니다.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-slate-950 p-5">
            <p className="text-xs text-slate-500">베트맨 승패 배당</p>
            <p className="mt-3 font-black">
              {moneyline
                ? `${away} ${moneyline.away.toFixed(2)} · ${home} ${moneyline.home.toFixed(2)}`
                : "미수신"}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-950 p-5">
            <p className="text-xs text-slate-500">배당 기준 승률</p>
            <p className="mt-3 font-black">
              {marketAway == null
                ? "미수신"
                : `${away} ${marketAway.toFixed(1)}% · ${home} ${marketHome!.toFixed(1)}%`}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-950 p-5">
            <p className="text-xs text-slate-500">AI 확률 비교</p>
            <p className="mt-3 text-xl font-black text-amber-400">
              {aiTeam ?? "-"}
            </p>
            <p className="mt-1 text-xs font-bold text-amber-300">
              {bestGap == null
                ? "배당 미수신"
                : `배당 기준과 ${Math.abs(bestGap).toFixed(1)}%p 차이`}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-950 p-5">
            <p className="text-xs text-slate-500">실제 U/O 기준</p>
            <p className="mt-3 text-xl font-black text-amber-400">
              {total ? `${total.line} ${totalPick}` : "미수신"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              언더 {total?.under?.toFixed(2) ?? "-"} · 오버{" "}
              {total?.over?.toFixed(2) ?? "-"} · AI {displayedPredictedTotal}점
            </p>
          </div>
        </div>

        {moneyline && (
          <div className="mt-6 rounded-2xl border border-amber-900/60 bg-slate-950 p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-black text-amber-400">동일 배당 실제 성적</p>
                <h3 className="mt-1 text-xl font-black">현재 배당 ±0.05 구간 승률</h3>
              </div>
              <p className="text-xs leading-5 text-slate-500">
                이 브라우저에 경기 전 저장된 배당과 완료 경기 결과를 기준으로 계산합니다.
              </p>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[sameOdds?.away, sameOdds?.home].map((item, index) => {
                const team = index === 0 ? away : home;
                const odds = index === 0 ? moneyline.away : moneyline.home;
                return (
                  <div
                    key={`${team}-same-odds`}
                    className="rounded-xl border border-slate-800 bg-slate-900 p-4"
                  >
                    <p className="font-black">{team}</p>
                    <p className="mt-2 text-sm text-slate-400">
                      현재 배당 {odds.toFixed(2)} · 비교 범위 {item?.range ?? "계산 중"}
                    </p>
                    {item && item.games > 0 ? (
                      <>
                        <p className="mt-3 text-2xl font-black text-amber-400">
                          {item.wins}승 {item.losses}패
                        </p>
                        <p className="mt-1 text-sm font-bold">
                          동일 배당 승률 {item.rate.toFixed(1)}% · 표본 {item.games}경기
                        </p>
                      </>
                    ) : (
                      <p className="mt-3 text-sm font-bold text-slate-500">
                        아직 완료된 동일 배당 표본이 없습니다.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <article className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm font-black text-blue-400">요일별 팀 성적</p>
          <h3 className="mt-2 text-xl font-black">{weekdayLabel} 경기 승률</h3>
          <div className="mt-5 space-y-3">
            <div className="rounded-xl bg-slate-950 p-4">
              {away} ·{" "}
              {weekdayAway?.games
                ? `${weekdayAway.wins}승 ${weekdayAway.draws}무 ${weekdayAway.losses}패 (${awayWeekRate?.toFixed(1)}%)`
                : "기록 없음"}
            </div>
            <div className="rounded-xl bg-slate-950 p-4">
              {home} ·{" "}
              {weekdayHome?.games
                ? `${weekdayHome.wins}승 ${weekdayHome.draws}무 ${weekdayHome.losses}패 (${homeWeekRate?.toFixed(1)}%)`
                : "기록 없음"}
            </div>
          </div>
        </article>
        <article className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm font-black text-blue-400">전문가 종합 분석</p>
          <h3 className="mt-2 text-xl font-black">최종 분석 결과</h3>
          <div className="mt-5 space-y-3 text-sm leading-7 text-slate-300">
            <p>• {marketSentence}</p>
            <p>• {weekdaySentence}</p>
            <p>
              • 선발·타격·최근 득실점·맞대결·홈 이점을 함께 반영해 최종 픽을
              산출합니다.
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}


function ExpertReportSection({
  prediction,
  away,
  home,
  awayStanding,
  homeStanding,
  awayBatting,
  homeBatting,
  awayStarter,
  homeStarter,
  awayForm,
  homeForm,
}: {
  prediction: Prediction;
  away: string;
  home: string;
  awayStanding?: KboStanding;
  homeStanding?: KboStanding;
  awayBatting?: TeamBatting;
  homeBatting?: TeamBatting;
  awayStarter?: StarterData;
  homeStarter?: StarterData;
  awayForm: TeamFormResponse | null;
  homeForm: TeamFormResponse | null;
}) {
  const fmt = (value: number | undefined, digits = 2) =>
    Number.isFinite(value) ? Number(value).toFixed(digits) : "-";
  const awayRecent = awayForm?.recent10.summary;
  const homeRecent = homeForm?.recent10.summary;
  const awayEra = awayStarter?.pitcher.era;
  const homeEra = homeStarter?.pitcher.era;
  const awayWhip = awayStarter?.pitcher.whip;
  const homeWhip = homeStarter?.pitcher.whip;
  const starterLeader =
    Number.isFinite(awayEra) && Number.isFinite(homeEra)
      ? Number(awayEra) <= Number(homeEra) ? away : home
      : "선발 정보 확인 필요";
  const offenseLeader =
    Number(awayBatting?.ops ?? 0) >= Number(homeBatting?.ops ?? 0) ? away : home;
  const recentLeader =
    Number(awayRecent?.wins ?? 0) >= Number(homeRecent?.wins ?? 0) ? away : home;
  const seasonLeader =
    Number(awayStanding?.winningPercentage ?? 0) >=
    Number(homeStanding?.winningPercentage ?? 0) ? away : home;

  const sections = [
    {
      title: "선발투수 매치업",
      text:
        awayStarter && homeStarter
          ? `${away} 선발 ${awayStarter.koreanName}는 시즌 ERA ${fmt(awayEra)}, WHIP ${fmt(awayWhip)}를 기록하고 있으며, ${home} 선발 ${homeStarter.koreanName}는 ERA ${fmt(homeEra)}, WHIP ${fmt(homeWhip)}입니다. 선발의 실점 억제력과 출루 허용 지표를 종합하면 ${starterLeader} 쪽이 경기 초반 주도권을 잡을 가능성이 더 높습니다. 다만 당일 제구와 투구 수 관리에 따라 격차는 달라질 수 있습니다.`
          : "양 팀 선발 중 일부가 아직 확정되지 않아 시즌 팀 투수력과 최근 경기 흐름을 중심으로 평가했습니다.",
    },
    {
      title: "타선 생산성",
      text:
        awayBatting && homeBatting
          ? `${away}의 팀 OPS는 ${fmt(awayBatting.ops, 3)}, ${home}는 ${fmt(homeBatting.ops, 3)}입니다. 타율뿐 아니라 출루율과 장타율을 함께 반영했을 때 ${offenseLeader} 타선이 상대적으로 높은 득점 생산력을 보입니다. 공격 지표 차이가 작다면 실제 승부는 득점권 집중력과 병살 회피 여부에서 갈릴 가능성이 큽니다.`
          : "타격 자료 일부가 비어 있어 시즌 승률과 최근 득점 흐름을 중심으로 타선 우위를 평가했습니다.",
    },
    {
      title: "최근 경기 흐름",
      text:
        awayRecent && homeRecent
          ? `최근 10경기에서 ${away}는 ${awayRecent.wins}승 ${awayRecent.draws}무 ${awayRecent.losses}패, ${home}는 ${homeRecent.wins}승 ${homeRecent.draws}무 ${homeRecent.losses}패입니다. 단기 흐름은 ${recentLeader} 쪽에 유리하지만, 최근 성적은 상대 일정 강도에 영향을 받기 때문에 시즌 전력보다 낮은 비중으로 반영했습니다.`
          : "최근 경기 표본이 충분하지 않아 단기 흐름은 중립값으로 처리했습니다.",
    },
    {
      title: "홈·원정 변수",
      text: `${away}의 원정 성적과 ${home}의 홈 성적을 비교하면 경기장 적응도와 마지막 공격권은 홈팀에 유리한 요소입니다. 다만 선발 격차가 크거나 초반 대량 득점이 발생하는 경기에서는 홈 이점의 영향력이 제한될 수 있습니다.`,
    },
    {
      title: "상대전적 해석",
      text:
        awayForm?.headToHead.summary.games
          ? `이번 시즌 맞대결은 ${awayForm.headToHead.summary.games}경기 표본입니다. 상대전적은 투수 유형과 구장 특성에 따른 반복 패턴을 확인하는 보조 지표로 활용했으며, 현재 선발과 최근 팀 컨디션보다 낮은 가중치를 적용했습니다.`
          : "시즌 맞대결 표본이 적어 상대전적은 핵심 근거가 아닌 보조 지표로만 반영했습니다.",
    },
    {
      title: "승부 핵심 포인트",
      text: `${seasonLeader}가 시즌 전력에서 앞서고, ${starterLeader}가 선발 매치업에서 우위를 보입니다. ${prediction.winner}가 승리하려면 초반 실점을 억제하고 5회 이전에 유리한 불펜 운영 구도를 만드는 것이 중요합니다. 반대 팀은 선발 투구 수를 빠르게 늘리고 경기 후반 접전으로 끌고 가야 승산이 높아집니다.`,
    },
    {
      title: "AI 최종 전망",
      text: `종합 모델은 ${prediction.winner} 승리 확률을 ${prediction.winner === away ? prediction.awayWinProbability : prediction.homeWinProbability}%로 평가합니다. 현재 신뢰도는 ${prediction.confidence}%이며, 시즌 전력·선발·타격·최근 흐름이 같은 방향을 가리킬수록 예측 신뢰도가 높아집니다. 예상 스코어는 ${away} ${prediction.awayScore}점, ${home} ${prediction.homeScore}점입니다.`,
    },
  ];

  return (
    <section className="mt-10">
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 md:p-8">
        <p className="text-sm font-black text-blue-400">KBO GAME PREVIEW</p>
        <h2 className="mt-2 text-2xl font-black">KBO 경기 프리뷰</h2>
        <div className="mt-6 grid gap-4">
          {sections.map((section, index) => (
            <article key={section.title} className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
              <div className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-950 text-sm font-black text-blue-400">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-black text-white">{section.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-300">{section.text}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-5 rounded-2xl border border-amber-900/60 bg-amber-950/10 p-5">
          <p className="text-sm font-black text-amber-400">분석 시 주의 변수</p>
          <div className="mt-3 space-y-2 text-sm leading-6 text-slate-400">
            <p>• 경기 당일 선발 변경과 주전 타자 결장은 반영 시점에 따라 누락될 수 있습니다.</p>
            <p>• 최근 3일 불펜 연투와 필승조 소모 여부는 경기 직전 다시 확인해야 합니다.</p>
            <p>• AI 확률은 공개 기록을 기반으로 한 상대 비교값이며 실제 결과를 보장하지 않습니다.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function PredictionSection({
  prediction,
  away,
  home,
}: {
  prediction: Prediction;
  away: string;
  home: string;
}) {
  const displayedPredictedTotal = prediction.awayScore + prediction.homeScore;

  return (
    <section className="mt-10 rounded-3xl border border-blue-800 bg-gradient-to-br from-blue-950/50 to-slate-900 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-blue-400">
            SPORTS AI 종합 예측
          </p>
          <h2 className="mt-2 text-2xl font-black">
            {prediction.winner} 승 추천
          </h2>
        </div>
        <span className="rounded-full bg-blue-600 px-4 py-2 text-sm font-black">
          신뢰도 {prediction.confidence}%
        </span>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-slate-950 p-5">
          <p className="text-xs text-slate-500">승리 확률</p>
          <div className="mt-4 flex justify-between font-black">
            <span>
              {away} {prediction.awayWinProbability}%
            </span>
            <span>
              {home} {prediction.homeWinProbability}%
            </span>
          </div>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-800">
            <div
              className="bg-slate-500"
              style={{ width: `${prediction.awayWinProbability}%` }}
            />
            <div
              className="bg-blue-600"
              style={{ width: `${prediction.homeWinProbability}%` }}
            />
          </div>
        </div>
        <div className="rounded-2xl bg-slate-950 p-5 text-center">
          <p className="text-xs text-slate-500">예상 스코어</p>
          <p className="mt-3 text-3xl font-black">
            {prediction.awayScore} : {prediction.homeScore}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {away} · {home}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-950 p-5 text-center">
          <p className="text-xs text-slate-500">AI 예상 총점</p>
          <p className="mt-3 text-3xl font-black text-blue-400">
            {displayedPredictedTotal}점
          </p>
          <p className="mt-2 text-xs text-slate-500">
            실제 언더/오버 추천은 아래 시장 기준점과 비교
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
          <div className="flex items-center justify-between">
            <p className="font-black">AI 근거 점수</p>
            <span className="rounded-full bg-blue-950 px-3 py-1 text-xs font-black text-blue-300">
              등급 {prediction.confidenceGrade}
            </span>
          </div>
          <div className="mt-4 space-y-4">
            {prediction.factors.map((factor) => (
              <div key={factor.label}>
                <div className="mb-2 flex justify-between text-xs">
                  <span className="text-slate-400">
                    {factor.label} · 가중치 {factor.weight}%
                  </span>
                  <span className="font-black">
                    {factor.away} : {factor.home}
                  </span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="bg-slate-500"
                    style={{
                      width: `${(factor.away / (factor.away + factor.home)) * 100}%`,
                    }}
                  />
                  <div
                    className="bg-blue-600"
                    style={{
                      width: `${(factor.home / (factor.away + factor.home)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
          <p className="font-black">AI 분석 근거</p>
          <div className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
            {prediction.reasons.map((reason) => (
              <p key={reason}>• {reason}</p>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-500">
        본 예측은 공개 경기 기록을 기반으로 한 참고용 분석이며 실제 결과를
        보장하지 않습니다.
      </p>
    </section>
  );
}
type StarterData = {
  pitcher: TeamPitcher;
  koreanName: string;
  opponentStats: OpponentPitchingStats | null;
    stadium?: string;
  currentVenueStats?: VenuePitchingStats | null;
  splits?: PitchingSplits;
  currentMonthStats?: SplitPitchingStats | null;
  currentWeekdayStats?: SplitPitchingStats | null;
  currentHomeAwayStats?: SplitPitchingStats | null;
  currentDayNightStats?: SplitPitchingStats | null;
  recent5?: RecentPitchingSummary | null;
  recent10?: RecentPitchingSummary | null;
  seasonStats?: {
    games: number;
    wins: number;
    losses: number;
    innings: string;
    era: number;
    whip: number;
    walks?: number;
    strikeouts?: number;
    homeRuns?: number;
  } | null;
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
    return (
      player === target || player.includes(target) || target.includes(player)
    );
  });
}

function createStarterPlaceholder(
  player: string,
  teamCode: string,
  team: string,
  pcode = "",
): TeamPitcher {
  return {
    pcode,
    player,
    teamCode,
    team,
    era: -1,
    games: 0,
    completeGames: 0,
    shutouts: 0,
    wins: 0,
    losses: 0,
    saves: 0,
    holds: 0,
    winningPercentage: 0,
    plateAppearances: 0,
    pitches: 0,
    innings: "-",
    inningsValue: 0,
    hits: 0,
    doubles: 0,
    triples: 0,
    homeRuns: 0,
    walks: 0,
    hitByPitch: 0,
    strikeouts: 0,
    runs: 0,
    earnedRuns: 0,
    whip: 0,
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
              <p className="text-xs font-bold text-slate-500">현재 순위</p>
              <p className="mt-2 text-2xl font-black">{standing.rank}위</p>
            </div>

            <div className="rounded-xl bg-slate-950 p-4">
              <p className="text-xs font-bold text-slate-500">승률</p>
              <p className="mt-2 text-2xl font-black">
                {formatAverage(standing.winningPercentage)}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3 rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">시즌 성적</span>
              <span className="font-black">
                {standing.wins}승 {standing.draws}무 {standing.losses}패
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-sm text-slate-500">홈 성적</span>
              <span className="font-bold">{standing.home || "-"}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-sm text-slate-500">원정 성적</span>
              <span className="font-bold">{standing.away || "-"}</span>
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
      <p className="text-left text-lg font-black">{awayValue}</p>

      <p className="text-center text-xs font-bold text-slate-500">{label}</p>

      <p className="text-right text-lg font-black">{homeValue}</p>
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
      <p className="text-sm font-black text-blue-400">팀 타격 비교</p>

      <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <p className="font-black">{awayName}</p>
        <p className="text-xs font-black text-slate-600">VS</p>
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
            awayValue={formatAverage(awayBatting.battingAverage)}
            homeValue={formatAverage(homeBatting.battingAverage)}
          />

          <ComparisonRow
            label="출루율"
            awayValue={formatAverage(awayBatting.onBasePercentage)}
            homeValue={formatAverage(homeBatting.onBasePercentage)}
          />

          <ComparisonRow
            label="장타율"
            awayValue={formatAverage(awayBatting.sluggingPercentage)}
            homeValue={formatAverage(homeBatting.sluggingPercentage)}
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


function SplitSummaryCard({
  title,
  stats,
}: {
  title: string;
  stats?: SplitPitchingStats | null;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <p className="text-xs font-black text-blue-400">{title}</p>
      {!stats ? (
        <p className="mt-3 text-sm text-slate-500">기록 없음</p>
      ) : (
        <div className="mt-3 space-y-2 text-sm">
          <p className="font-black">
            {(["월", "화", "수", "목", "금", "토", "일"].includes(stats.label)
              ? `${stats.label}요일`
              : stats.label === "방문"
                ? "원정"
                : stats.label)}{" "}
            · {stats.games}경기 · {stats.wins}승 {stats.losses}패
          </p>
          <p>
            ERA {formatEra(stats.era)} · WHIP{" "}
            {stats.whip > 0 ? stats.whip.toFixed(2) : "-"}
          </p>
          <p className="text-slate-400">
            {stats.innings}이닝 · 볼넷 {stats.walks} · 탈삼진 {stats.strikeouts}
          </p>
        </div>
      )}
    </div>
  );
}

function SplitTable({
  title,
  rows,
}: {
  title: string;
  rows?: SplitPitchingStats[];
}) {
  if (!rows?.length) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
      <div className="border-b border-slate-800 px-4 py-3">
        <p className="text-sm font-black text-blue-400">{title}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[720px] w-full text-sm">
          <thead className="bg-slate-900 text-xs text-slate-500">
            <tr>
              <th className="px-3 py-3 text-left">구분</th>
              <th className="px-3 py-3 text-right">G</th>
              <th className="px-3 py-3 text-right">승-패</th>
              <th className="px-3 py-3 text-right">이닝</th>
              <th className="px-3 py-3 text-right">ERA</th>
              <th className="px-3 py-3 text-right">WHIP</th>
              <th className="px-3 py-3 text-right">BB</th>
              <th className="px-3 py-3 text-right">SO</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={`${title}-${row.label}-${index}`}
                className="border-t border-slate-800 first:border-t-0"
              >
                <td className="px-3 py-3 font-black">{row.label}</td>
                <td className="px-3 py-3 text-right">{row.games}</td>
                <td className="px-3 py-3 text-right">
                  {row.wins}-{row.losses}
                </td>
                <td className="px-3 py-3 text-right">{row.innings}</td>
                <td className="px-3 py-3 text-right font-black">
                  {formatEra(row.era)}
                </td>
                <td className="px-3 py-3 text-right">
                  {row.whip > 0 ? row.whip.toFixed(2) : "-"}
                </td>
                <td className="px-3 py-3 text-right">{row.walks}</td>
                <td className="px-3 py-3 text-right">{row.strikeouts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
              <p className="text-2xl font-black">{starter.koreanName}</p>
              <p className="mt-1 text-xs text-slate-500">공식 발표 기준</p>
            </div>

            <div className="text-right">
              <p className="text-xs font-bold text-slate-500">시즌 ERA</p>
              <p className="mt-1 text-3xl font-black text-blue-400">
                {formatEra(starter.pitcher.era)}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-slate-950 p-3 text-center">
              <p className="text-xs text-slate-500">승패</p>
              <p className="mt-2 font-black">
                {starter.pitcher.wins}승 {starter.pitcher.losses}패
              </p>
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
              <p className="mt-2 text-lg font-black">
                {starter.pitcher.whip > 0
                  ? starter.pitcher.whip.toFixed(2)
                  : "-"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <p className="text-xs text-slate-500">볼넷</p>
              <p className="mt-2 text-lg font-black">
                {starter.pitcher.walks > 0 ? `${starter.pitcher.walks}개` : "-"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <p className="text-xs text-slate-500">탈삼진</p>
              <p className="mt-2 text-lg font-black">
                {starter.pitcher.strikeouts > 0
                  ? `${starter.pitcher.strikeouts}개`
                  : "-"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <p className="text-xs text-slate-500">피홈런</p>
              <p className="mt-2 text-lg font-black">
                {starter.pitcher.homeRuns > 0
                  ? `${starter.pitcher.homeRuns}개`
                  : "-"}
              </p>
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
                  <span className="text-slate-500">상대 ERA</span>
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
                  <span className="text-slate-500">탈삼진</span>
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
              {starter.recent5 ? (
                <div className="mt-3 space-y-2 text-sm">
                  <p>
                    {starter.recent5.games}경기 · {starter.recent5.wins}승{" "}
                    {starter.recent5.losses}패
                  </p>
                  <p>
                    ERA {formatEra(starter.recent5.era)} · WHIP{" "}
                    {starter.recent5.whip.toFixed(2)}
                  </p>
                  <p>
                    QS {starter.recent5.qualityStarts}회 ·{" "}
                    {starter.recent5.innings}이닝
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  최근 경기 상세 기록을 불러오지 못했습니다.
                </p>
              )}
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
              <p className="text-sm font-black text-blue-400">
                {starter.stadium || stadium || "오늘 구장"} 성적
              </p>
              {starter.currentVenueStats ? (
                <div className="mt-3 space-y-2 text-sm">
                  <p>
                    {starter.currentVenueStats.games}경기 ·{" "}
                    {starter.currentVenueStats.wins}승{" "}
                    {starter.currentVenueStats.losses}패
                  </p>
                  <p>
                    승률{" "}
                    {(
                      starter.currentVenueStats.winningPercentage * 100
                    ).toFixed(1)}
                    % · ERA {formatEra(starter.currentVenueStats.era)}
                  </p>
                  <p>
                    WHIP{" "}
                    {starter.currentVenueStats.whip
                      ? starter.currentVenueStats.whip.toFixed(2)
                      : "-"}{" "}
                    · {starter.currentVenueStats.innings}이닝
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  해당 구장 시즌 기록이 없거나 공식 표에서 확인되지 않았습니다.
                </p>
              )}
            </div>
          </div>

          <div className="mt-6">
            <p className="text-sm font-black text-blue-400">오늘 경기 조건별 성적</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <SplitSummaryCard
                title="이번 달"
                stats={starter.currentMonthStats}
              />
              <SplitSummaryCard
                title="오늘 요일"
                stats={starter.currentWeekdayStats}
              />
              <SplitSummaryCard
                title="홈 / 원정"
                stats={starter.currentHomeAwayStats}
              />
            </div>
          </div>

          {starter.splits && (
            <details className="mt-6 rounded-xl border border-slate-800 bg-slate-950">
              <summary className="cursor-pointer px-4 py-4 font-black text-blue-400">
                구장별 · 월별 · 요일별 · 홈/원정별 · 기간별 전체 기록 보기
              </summary>
              <div className="space-y-4 border-t border-slate-800 p-4">
                <SplitTable title="구장별" rows={starter.splits.venue} />
                <SplitTable title="월별" rows={starter.splits.month} />
                <SplitTable title="요일별" rows={starter.splits.weekday} />
                <SplitTable title="홈 / 원정별" rows={starter.splits.homeAway} />
                <SplitTable title="기간별" rows={starter.splits.period} />
              </div>
            </details>
          )}
        </>
      )}
    </article>
  );
}

function ResultBadge({ result }: { result: TeamGame["result"] }) {
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
      <p className="text-sm font-black text-blue-400">{title}</p>

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
              <p className="text-xs text-slate-500">경기당 평균 득점</p>
              <p className="mt-2 text-xl font-black">
                {section.summary.averageRunsScored.toFixed(2)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-xs text-slate-500">경기당 평균 실점</p>
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
  teamName,
  games,
}: {
  title: string;
  teamName: string;
  games: TeamGame[];
}) {
  const compact = title.includes("맞대결");
  const visibleGames = compact ? games.slice(0, 8) : games;

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6">
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
      ) : (
        <div className={`mt-5 grid gap-3 ${compact ? "md:grid-cols-2" : ""}`}>
          {visibleGames.map((game, index) => {
            const teamIsHome = game.location === "홈";
            const leftName = teamIsHome ? teamName : game.opponent;
            const rightName = teamIsHome ? game.opponent : teamName;
            const leftScore = teamIsHome ? game.teamScore : game.opponentScore;
            const rightScore = teamIsHome ? game.opponentScore : game.teamScore;
            const leftResult = leftScore > rightScore ? "승" : leftScore < rightScore ? "패" : "무";
            const rightResult = rightScore > leftScore ? "승" : rightScore < leftScore ? "패" : "무";
            const resultClass = (result: "승" | "패" | "무") =>
              result === "승" ? "text-blue-400" : result === "패" ? "text-red-400" : "text-slate-300";

            return (
              <div
                key={`${game.date}-${game.opponent}-${index}`}
                className="rounded-xl border border-slate-800 bg-slate-950 p-4"
              >
                <p className="text-xs font-bold text-slate-500">
                  {game.date}{game.stadium ? ` · ${game.stadium}` : ""}
                </p>
                <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                  <div className="min-w-0">
                    <p className={`truncate font-black ${resultClass(leftResult)}`}>
                      {leftResult} {leftName}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-black text-slate-500">vs</p>
                    <p className="mt-1 whitespace-nowrap text-base font-black">
                      {leftScore} : {rightScore}
                    </p>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className={`truncate font-black ${resultClass(rightResult)}`}>
                      {rightName} {rightResult}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
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
      <p className="text-sm font-black text-blue-400">이번 시즌 상대전적</p>

      <div className="mt-3 text-center text-xs font-bold text-slate-500">
        시즌 완료 경기 {awaySection?.summary.games ?? 0}경기 · 무승부{" "}
        {awaySection?.summary.draws ?? 0}경기
      </div>

      <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-center">
        <div>
          <p className="text-sm text-slate-500">{awayName}</p>
          <p className="mt-2 text-4xl font-black">
            {awaySection?.summary.wins ?? 0}승{" "}
            {awaySection?.summary.losses ?? 0}패
          </p>
          {(awaySection?.summary.draws ?? 0) > 0 && (
            <p className="mt-1 text-sm font-bold text-slate-500">
              {awaySection?.summary.draws ?? 0}무
            </p>
          )}
        </div>

        <span className="text-sm font-black text-slate-600">VS</span>

        <div>
          <p className="text-sm text-slate-500">{homeName}</p>
          <p className="mt-2 text-4xl font-black">
            {homeSection?.summary.wins ?? 0}승{" "}
            {homeSection?.summary.losses ?? 0}패
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
          <p className="text-xs text-slate-500">{awayName} 평균 득점</p>
          <p className="mt-2 text-xl font-black">
            {(awaySection?.summary.averageRunsScored ?? 0).toFixed(2)}
          </p>
        </div>

        <div className="rounded-xl bg-slate-950 p-4 text-center">
          <p className="text-xs text-slate-500">{homeName} 평균 득점</p>
          <p className="mt-2 text-xl font-black">
            {(homeSection?.summary.averageRunsScored ?? 0).toFixed(2)}
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
  const [awayStarter, setAwayStarter] = useState<StarterData | undefined>();
  const [homeStarter, setHomeStarter] = useState<StarterData | undefined>();

  const [awayForm, setAwayForm] = useState<TeamFormResponse | null>(null);
  const [homeForm, setHomeForm] = useState<TeamFormResponse | null>(null);

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

          fetch(dataCacheUrl("/api/kbo/team-batting", 1800), {
            cache: "no-store",
            signal: controller.signal,
          }),

          fetch(dataCacheUrl(`/api/kbo/team-pitching?team=${encodeURIComponent(awayCode)}`, 1800), {
            cache: "no-store",
            signal: controller.signal,
          }),

          fetch(dataCacheUrl(`/api/kbo/team-pitching?team=${encodeURIComponent(homeCode)}`, 1800), {
            cache: "no-store",
            signal: controller.signal,
          }),

          fetch(
            dataCacheUrl(`/api/kbo/team-form?team=${encodeURIComponent(
              awayCode,
            )}&opponent=${encodeURIComponent(
              homeCode,
            )}&date=${encodeURIComponent(date)}`, 600),
            {
              cache: "no-store",
              signal: controller.signal,
            },
          ),

          fetch(
            dataCacheUrl(`/api/kbo/team-form?team=${encodeURIComponent(
              homeCode,
            )}&opponent=${encodeURIComponent(
              awayCode,
            )}&date=${encodeURIComponent(date)}`, 600),
            {
              cache: "no-store",
              signal: controller.signal,
            },
          ),
        ]);

        const standingsData =
          (await standingsResponse.json()) as StandingsResponse;

        const battingData = (await battingResponse.json()) as BattingResponse;

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
            standingsData.message ?? "팀 순위를 불러오지 못했습니다.",
          );
        }

        if (!battingResponse.ok || !battingData.success) {
          throw new Error(
            battingData.message ?? "팀 타격 기록을 불러오지 못했습니다.",
          );
        }

        // 투수 시즌 기록 API가 일시적으로 실패해도
        // 순위·타격·최근 경기·맞대결 분석 화면은 계속 표시합니다.
        const awayPitchers =
          awayPitchingResponse.ok && awayPitchingData.success
            ? (awayPitchingData.pitchers ?? [])
            : [];

        const homePitchers =
          homePitchingResponse.ok && homePitchingData.success
            ? (homePitchingData.pitchers ?? [])
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
          ? (matchedAwayPitcher ??
            createStarterPlaceholder(
              awayStarterName,
              awayCode,
              away,
              awayStarterCode,
            ))
          : undefined;

        const homePitcher = homeStarterName
          ? (matchedHomePitcher ??
            createStarterPlaceholder(
              homeStarterName,
              homeCode,
              home,
              homeStarterCode,
            ))
          : undefined;

        const opponentRequests: Promise<Response>[] = [];

        if (awayPitcher) {
          opponentRequests.push(
            fetch(
              dataCacheUrl(`/api/kbo/pitcher-vs-team?pcode=${encodeURIComponent(awayPitcher.pcode || "")}&name=${encodeURIComponent(awayStarterName || awayPitcher.player)}&opponent=${encodeURIComponent(homeCode)}&stadium=${encodeURIComponent(stadium)}&team=${encodeURIComponent(awayCode)}&homeTeam=${encodeURIComponent(homeCode)}&side=away&date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}`, 21600),
              { cache: "no-store", signal: controller.signal },
            ),
          );
        }
        if (homePitcher) {
          opponentRequests.push(
            fetch(
              dataCacheUrl(`/api/kbo/pitcher-vs-team?pcode=${encodeURIComponent(homePitcher.pcode || "")}&name=${encodeURIComponent(homeStarterName || homePitcher.player)}&opponent=${encodeURIComponent(awayCode)}&stadium=${encodeURIComponent(stadium)}&team=${encodeURIComponent(homeCode)}&homeTeam=${encodeURIComponent(homeCode)}&side=home&date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}`, 21600),
              { cache: "no-store", signal: controller.signal },
            ),
          );
        }

        const opponentResponses = await Promise.all(opponentRequests);

        let responseIndex = 0;

        if (awayPitcher) {
          let data: PitcherVsTeamResponse | null = null;
          const response = opponentResponses[responseIndex];
          responseIndex += 1;
          if (response?.ok)
            data = (await response.json()) as PitcherVsTeamResponse;
          const awaySeason = data?.seasonStats;
          setAwayStarter({
            pitcher: awaySeason
              ? {
                  ...awayPitcher,
                  games: awaySeason.games,
                  wins: awaySeason.wins,
                  losses: awaySeason.losses,
                  innings: awaySeason.innings,
                  inningsValue:
                    Number.parseFloat(awaySeason.innings) ||
                    awayPitcher.inningsValue,
                  era: awaySeason.era,
                  whip: awaySeason.whip,
                  walks: awaySeason.walks ?? awayPitcher.walks,
                  strikeouts: awaySeason.strikeouts ?? awayPitcher.strikeouts,
                  homeRuns: awaySeason.homeRuns ?? awayPitcher.homeRuns,
                }
              : awayPitcher,
            koreanName:
              awayStarterName || data?.playerName || awayPitcher.player,
            opponentStats: data?.found ? data.stats : null,
            stadium: data?.stadium || stadium,
            currentVenueStats: data?.currentVenueStats ?? null,
            splits: data?.splits,
            currentMonthStats: data?.currentMonthStats ?? null,
            currentWeekdayStats: data?.currentWeekdayStats ?? null,
            currentHomeAwayStats: data?.currentHomeAwayStats ?? null,
            currentDayNightStats: data?.currentDayNightStats ?? null,
            recent5: data?.recent5 ?? null,
            recent10: data?.recent10 ?? null,
          });
        } else {
          setAwayStarter(undefined);
        }

        if (homePitcher) {
          let data: PitcherVsTeamResponse | null = null;
          const response = opponentResponses[responseIndex];
          if (response?.ok)
            data = (await response.json()) as PitcherVsTeamResponse;
          const homeSeason = data?.seasonStats;
          setHomeStarter({
            pitcher: homeSeason
              ? {
                  ...homePitcher,
                  games: homeSeason.games,
                  wins: homeSeason.wins,
                  losses: homeSeason.losses,
                  innings: homeSeason.innings,
                  inningsValue:
                    Number.parseFloat(homeSeason.innings) ||
                    homePitcher.inningsValue,
                  era: homeSeason.era,
                  whip: homeSeason.whip,
                  walks: homeSeason.walks ?? homePitcher.walks,
                  strikeouts: homeSeason.strikeouts ?? homePitcher.strikeouts,
                  homeRuns: homeSeason.homeRuns ?? homePitcher.homeRuns,
                }
              : homePitcher,
            koreanName:
              homeStarterName || data?.playerName || homePitcher.player,
            opponentStats: data?.found ? data.stats : null,
            stadium: data?.stadium || stadium,
            currentVenueStats: data?.currentVenueStats ?? null,
            splits: data?.splits,
            currentMonthStats: data?.currentMonthStats ?? null,
            currentWeekdayStats: data?.currentWeekdayStats ?? null,
            currentHomeAwayStats: data?.currentHomeAwayStats ?? null,
            currentDayNightStats: data?.currentDayNightStats ?? null,
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
        if (error instanceof Error && error.name === "AbortError") {
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

  const awayStanding = standings.find((item) => item.team === away);

  const homeStanding = standings.find((item) => item.team === home);

  const awayBatting = batting.find((item) => item.team === away);

  const homeBatting = batting.find((item) => item.team === home);

  const prediction = makePrediction({
    awayName: away,
    homeName: home,
    awayStanding,
    homeStanding,
    awayBatting,
    homeBatting,
    awayStarter,
    homeStarter,
    awayForm,
    homeForm,
  });

  useEffect(() => {
    if (loading || errorMessage) return;
    savePregamePrediction({
      league: "KBO",
      date,
      time,
      away,
      home,
      pick: prediction.winner,
      awayRate: prediction.awayWinProbability,
      homeRate: prediction.homeWinProbability,
      confidence: prediction.confidence,
    });
  }, [loading, errorMessage, date, time, away, home, prediction.winner, prediction.awayWinProbability, prediction.homeWinProbability, prediction.confidence]);

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
            <p className="text-sm font-black text-blue-400">{date}</p>

            <p className="mt-2 text-sm text-slate-400">
              {time}
              {stadium ? ` · ${stadium}` : ""}
            </p>
          </div>

          <div className="mt-10 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div className="text-center">
              <p className="text-xs font-bold text-slate-500">원정팀</p>
              <h1 className="mt-3 text-xl font-black md:text-3xl">{away}</h1>
            </div>

            <div className="rounded-full border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-black text-slate-500">
              VS
            </div>

            <div className="text-center">
              <p className="text-xs font-bold text-blue-400">홈팀</p>
              <h2 className="mt-3 text-xl font-black md:text-3xl">{home}</h2>
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
              <h2 className="mb-5 text-2xl font-black">선발투수 비교</h2>

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
              <h2 className="text-2xl font-black">최근 경기 흐름</h2>

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
                  teamName={away}
                  games={awayForm?.recent10.games ?? []}
                />

                <GameHistoryList
                  title={`${home} 최근 경기`}
                  teamName={home}
                  games={homeForm?.recent10.games ?? []}
                />
              </div>
            </section>

            <section className="mt-10">
              <h2 className="text-2xl font-black">팀 상대전적</h2>

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
                  teamName={away}
                  games={awayForm?.headToHead.games ?? []}
                />
              </div>
            </section>
          </>
        )}

        {!loading && !errorMessage && (
          <>
            <ExpertReportSection
              prediction={prediction}
              away={away}
              home={home}
              awayStanding={awayStanding}
              homeStanding={homeStanding}
              awayBatting={awayBatting}
              homeBatting={homeBatting}
              awayStarter={awayStarter}
              homeStarter={homeStarter}
              awayForm={awayForm}
              homeForm={homeForm}
            />
            <PredictionSection prediction={prediction} away={away} home={home} />
          </>
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
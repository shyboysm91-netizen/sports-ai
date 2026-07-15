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
  message?: string;
};

type PitcherVsTeamResponse = {
  success: boolean;
  pcode: string;
  playerName: string;
  opponent: string;
  found: boolean;
  stats: OpponentPitchingStats | null;
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

type StarterData = {
  pitcher: TeamPitcher;
  koreanName: string;
  opponentStats: OpponentPitchingStats | null;
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

function selectEstimatedStarter(pitchers: TeamPitcher[]) {
  const candidates = pitchers
    .filter((pitcher) => {
      if (!pitcher.pcode) {
        return false;
      }

      if (pitcher.inningsValue < 20) {
        return false;
      }

      if (pitcher.saves >= 3 || pitcher.holds >= 5) {
        return false;
      }

      const inningsPerGame =
        pitcher.games > 0
          ? pitcher.inningsValue / pitcher.games
          : 0;

      return inningsPerGame >= 3;
    })
    .sort((a, b) => {
      if (b.inningsValue !== a.inningsValue) {
        return b.inningsValue - a.inningsValue;
      }

      return a.era - b.era;
    });

  return candidates[0];
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
  highlight = false,
}: {
  teamName: string;
  starter?: StarterData;
  opponentName: string;
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
        추정 선발
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
                공식 선발 발표 전 추정값
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
              <p className="mt-2 font-black">
                {starter.pitcher.wins}승{" "}
                {starter.pitcher.losses}패
              </p>
            </div>

            <div className="rounded-xl bg-slate-950 p-3 text-center">
              <p className="text-xs text-slate-500">이닝</p>
              <p className="mt-2 font-black">
                {starter.pitcher.innings}
              </p>
            </div>

            <div className="rounded-xl bg-slate-950 p-3 text-center">
              <p className="text-xs text-slate-500">경기</p>
              <p className="mt-2 font-black">
                {starter.pitcher.games}
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
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <h3 className="text-lg font-black">{title}</h3>

      {games.length === 0 ? (
        <p className="mt-5 text-sm text-slate-500">
          경기 기록이 없습니다.
        </p>
      ) : (
        <div className="mt-5 space-y-3">
          {games.map((game, index) => (
            <div
              key={`${game.date}-${game.opponent}-${index}`}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-xl border border-slate-800 bg-slate-950 p-4"
            >
              <ResultBadge result={game.result} />

              <div>
                <p className="font-black">
                  {game.location} · {game.opponent}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {game.date}
                  {game.stadium ? ` · ${game.stadium}` : ""}
                </p>
              </div>

              <p className="text-lg font-black">
                {game.teamScore} : {game.opponentScore}
              </p>
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

      <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-center">
        <div>
          <p className="text-sm text-slate-500">{awayName}</p>
          <p className="mt-2 text-4xl font-black">
            {awaySection?.summary.wins ?? 0}승
          </p>
        </div>

        <span className="text-sm font-black text-slate-600">
          VS
        </span>

        <div>
          <p className="text-sm text-slate-500">{homeName}</p>
          <p className="mt-2 text-4xl font-black">
            {homeSection?.summary.wins ?? 0}승
          </p>
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

        if (
          !awayPitchingResponse.ok ||
          !awayPitchingData.success
        ) {
          throw new Error(
            awayPitchingData.message ??
              "원정팀 투수 기록을 불러오지 못했습니다.",
          );
        }

        if (
          !homePitchingResponse.ok ||
          !homePitchingData.success
        ) {
          throw new Error(
            homePitchingData.message ??
              "홈팀 투수 기록을 불러오지 못했습니다.",
          );
        }

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

        const awayPitcher = selectEstimatedStarter(
          awayPitchingData.pitchers ?? [],
        );

        const homePitcher = selectEstimatedStarter(
          homePitchingData.pitchers ?? [],
        );

        const opponentRequests: Promise<Response>[] = [];

        if (awayPitcher) {
          opponentRequests.push(
            fetch(
              `/api/kbo/pitcher-vs-team?pcode=${encodeURIComponent(
                awayPitcher.pcode,
              )}&opponent=${encodeURIComponent(homeCode)}`,
              {
                cache: "no-store",
                signal: controller.signal,
              },
            ),
          );
        }

        if (homePitcher) {
          opponentRequests.push(
            fetch(
              `/api/kbo/pitcher-vs-team?pcode=${encodeURIComponent(
                homePitcher.pcode,
              )}&opponent=${encodeURIComponent(awayCode)}`,
              {
                cache: "no-store",
                signal: controller.signal,
              },
            ),
          );
        }

        const opponentResponses =
          await Promise.all(opponentRequests);

        let responseIndex = 0;

        if (awayPitcher) {
          const response = opponentResponses[responseIndex];
          responseIndex += 1;

          const data =
            (await response.json()) as PitcherVsTeamResponse;

          setAwayStarter({
            pitcher: awayPitcher,
            koreanName: data.playerName || awayPitcher.player,
            opponentStats: data.found ? data.stats : null,
          });
        }

        if (homePitcher) {
          const response = opponentResponses[responseIndex];

          const data =
            (await response.json()) as PitcherVsTeamResponse;

          setHomeStarter({
            pitcher: homePitcher,
            koreanName: data.playerName || homePitcher.player,
            opponentStats: data.found ? data.stats : null,
          });
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

        console.error("경기 상세 데이터 오류:", error);

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
                />

                <StarterCard
                  teamName={home}
                  starter={homeStarter}
                  opponentName={away}
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

        <section className="mt-10 rounded-2xl border border-blue-900 bg-blue-950/30 p-6">
          <p className="text-sm font-black text-blue-400">
            AI 경기 분석
          </p>

          <p className="mt-4 text-xl font-black">
            다음 단계에서 승률 계산과 분석 문장을 연결합니다.
          </p>
        </section>
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
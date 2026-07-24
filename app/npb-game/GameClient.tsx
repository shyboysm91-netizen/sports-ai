"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { dataCacheUrl } from "../lib/client-data-cache";
import { savePregamePrediction } from "../lib/prediction-history";

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 md:p-6">
      <p className="text-sm font-black text-blue-400">{title}</p>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-slate-950 p-4">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-black">{value}</p>
    </div>
  );
}

function fmt(value: unknown, digits = 3) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(digits)
    : "-";
}

function shortTeamName(name?: string | null) {
  if (!name) return "팀 정보 없음";

  const teamMap: Record<string, string> = {
    "한신 타이거스": "한신",
    "한신 타이거즈": "한신",
    "요미우리 자이언츠": "요미우리",
    "요코하마 DeNA 베이스타스": "요코하마",
    "요코하마 DeNA 베이스타즈": "요코하마",
    "주니치 드래건스": "주니치",
    "히로시마 도요 카프": "히로시마",
    "도쿄 야쿠르트 스왈로스": "야쿠르트",
    "후쿠오카 소프트뱅크 호크스": "소프트뱅크",
    "홋카이도 닛폰햄 파이터스": "닛폰햄",
    "홋카이도 닛폰햄 파이터즈": "닛폰햄",
    "오릭스 버팔로스": "오릭스",
    "도호쿠 라쿠텐 골든이글스": "라쿠텐",
    "사이타마 세이부 라이온스": "세이부",
    "사이타마 세이부 라이온즈": "세이부",
    "지바 롯데 마린스": "치바롯데",
    "치바롯데 마린스": "치바롯데",
  };

  return teamMap[name] ?? name;
}

function advantageLabel(
  score: number,
  away: string,
  home: string,
): {
  team: string;
  strength: string;
  stars: string;
} {
  const absolute = Math.abs(score);

  if (absolute < 0.3) {
    return {
      team: "거의 비슷",
      strength: "차이 없음",
      stars: "★★★☆☆",
    };
  }

  const team = score > 0 ? shortTeamName(home) : shortTeamName(away);
  let strength = "근소 우세";
  let stars = "★★★☆☆";

  if (absolute >= 3) {
    strength = "뚜렷한 우세";
    stars = "★★★★★";
  } else if (absolute >= 1.5) {
    strength = "우세";
    stars = "★★★★☆";
  }

  return { team, strength, stars };
}

function PitcherTable({ items }: { items: any[] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[620px] text-left text-sm">
        <thead className="text-xs text-slate-500">
          <tr>
            <th className="py-2">선수</th>
            <th>승-패</th>
            <th>이닝</th>
            <th>ERA</th>
            <th>WHIP</th>
            <th>볼넷</th>
            <th>삼진</th>
          </tr>
        </thead>
        <tbody>
          {items.slice(0, 5).map((pitcher: any) => (
            <tr key={pitcher.name} className="border-t border-slate-800">
              <td className="py-3 font-black">{pitcher.name}</td>
              <td>
                {pitcher.wins}-{pitcher.losses}
              </td>
              <td>{pitcher.innings}</td>
              <td>{fmt(pitcher.era, 2)}</td>
              <td>{fmt(pitcher.whip, 2)}</td>
              <td>{Math.round(Number(pitcher.walks) || 0)}</td>
              <td>{Math.round(Number(pitcher.strikeouts) || 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {items.length === 0 && (
        <p className="py-5 text-slate-500">투수 기록을 불러오지 못했습니다.</p>
      )}
    </div>
  );
}

function TeamPanel({
  name,
  standing,
  batting,
  pitching,
  side,
}: {
  name: string;
  standing: any;
  batting: any;
  pitching: any;
  side: "home" | "away";
}) {
  return (
    <Card title={side === "home" ? "홈팀 종합 기록" : "원정팀 종합 기록"}>
      <h2 className="mt-2 text-xl font-black">{name}</h2>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Metric label="순위" value={standing ? `${standing.rank}위` : "-"} />
        <Metric label="승률" value={fmt(standing?.winningPercentage)} />
        <Metric
          label="시즌 성적"
          value={
            standing
              ? `${standing.wins}승 ${standing.losses}패 ${standing.draws}무`
              : "-"
          }
        />
        <Metric
          label={side === "home" ? "홈 성적" : "원정 성적"}
          value={standing?.[side] || "-"}
        />
        <Metric label="팀 타율" value={fmt(batting?.average)} />
        <Metric label="팀 OPS" value={fmt(batting?.ops)} />
        <Metric
          label="홈런 / 볼넷"
          value={
            batting
              ? `${Math.round(batting.homeRuns)}개 / ${Math.round(batting.walks)}개`
              : "-"
          }
        />
        <Metric
          label="삼진"
          value={
            batting?.strikeouts !== undefined
              ? `${Math.round(batting.strikeouts)}개`
              : "-"
          }
        />
        <Metric label="팀 ERA" value={fmt(pitching?.era, 2)} />
        <Metric label="팀 WHIP" value={fmt(pitching?.whip, 2)} />
      </div>
    </Card>
  );
}

function RecentPanel({ title, data }: { title: string; data: any }) {
  const summary = data?.summary;
  const games = data?.games || [];
  const teamName = shortTeamName(data?.team || title.replace(" 최근 10경기", ""));
  const homeGames = games.filter((game: any) => game.location === "홈" || game.isHome === true);
  const awayGames = games.filter((game: any) => !(game.location === "홈" || game.isHome === true));
  const homeWins = homeGames.filter((game: any) => game.result === "승").length;
  const homeLosses = homeGames.filter((game: any) => game.result === "패").length;
  const awayWins = awayGames.filter((game: any) => game.result === "승").length;
  const awayLosses = awayGames.filter((game: any) => game.result === "패").length;

  return (
    <Card title={`${teamName} 최근 10경기`}>
      {games.length ? (
        <>
          <p className="mt-2 text-sm font-bold text-slate-400">
            최근 {games.length}경기 {summary.wins}승 {summary.draws ? `${summary.draws}무 ` : ""}{summary.losses}패 · 홈 {homeWins}승 {homeLosses}패 · 원정 {awayWins}승 {awayLosses}패 · 득점 {Math.round((summary.averageRunsFor || 0) * summary.games)} / 실점 {Math.round((summary.averageRunsAgainst || 0) * summary.games)}
          </p>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
            <div className="grid grid-cols-[52px_58px_1fr_64px_1fr] bg-slate-950 px-3 py-2 text-center text-xs font-black text-slate-500">
              <span>결과</span>
              <span>날짜</span>
              <span>홈</span>
              <span>점수</span>
              <span>원정</span>
            </div>
            {games.slice(0, 10).map((game: any, index: number) => {
              const hasFullMatch =
                game.homeTeam &&
                game.awayTeam &&
                Number.isFinite(game.homeScore) &&
                Number.isFinite(game.awayScore);
              const isHome = game.location === "홈" || game.isHome === true;
              const homeTeam = hasFullMatch
                ? shortTeamName(game.homeTeam)
                : isHome
                  ? teamName
                  : shortTeamName(game.opponent);
              const awayTeam = hasFullMatch
                ? shortTeamName(game.awayTeam)
                : isHome
                  ? shortTeamName(game.opponent)
                  : teamName;
              const homeScore = hasFullMatch
                ? game.homeScore
                : isHome
                  ? game.runsFor
                  : game.runsAgainst;
              const awayScore = hasFullMatch
                ? game.awayScore
                : isHome
                  ? game.runsAgainst
                  : game.runsFor;

              return (
                <div
                  key={`${game.date}-${game.homeTeam || game.opponent}-${index}`}
                  className="grid grid-cols-[52px_58px_1fr_64px_1fr] items-center border-t border-slate-800 px-3 py-3 text-center text-sm"
                >
                  <b
                    className={
                      game.result === "승"
                        ? "text-blue-400"
                        : game.result === "패"
                          ? "text-red-400"
                          : "text-slate-300"
                    }
                  >
                    {game.result}
                  </b>
                  <span className="text-xs text-slate-400">{String(game.date).slice(5)}</span>
                  <span className="truncate font-bold">{homeTeam}</span>
                  <b>{homeScore} : {awayScore}</b>
                  <span className="truncate font-bold">{awayTeam}</span>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          최근 경기 기록을 불러오지 못했습니다.
        </p>
      )}
    </Card>
  );
}

function HeadToHeadPanel({ away, home, data }: { away: string; home: string; data: any }) {
  const games = (data?.games || [])
    .filter((game: any) => {
      const homeScore = Number(game.homeScore);
      const awayScore = Number(game.awayScore);
      return Number.isFinite(homeScore) && Number.isFinite(awayScore) && !(homeScore === 0 && awayScore === 0);
    })
    .slice(0, 10);
  const awayWins = games.filter((game: any) => game.awayTeam === away ? Number(game.awayScore) > Number(game.homeScore) : Number(game.homeScore) > Number(game.awayScore)).length;
  const homeWins = games.filter((game: any) => game.homeTeam === home ? Number(game.homeScore) > Number(game.awayScore) : Number(game.awayScore) > Number(game.homeScore)).length;
  const draws = games.filter((game: any) => Number(game.homeScore) === Number(game.awayScore)).length;
  const isTie = awayWins === homeWins;
  const leader = awayWins > homeWins ? away : home;
  const teamClass = (name: string) => isTie ? "text-slate-200" : name === leader ? "text-red-400" : "text-blue-400";

  return (
    <Card title="최근 맞대결 10경기">
      {games.length ? (
        <>
          <p className="mt-2 text-sm font-black">
            <span className={teamClass(away)}>{shortTeamName(away)} {awayWins}승</span>
            <span className="text-slate-500"> · </span>
            <span className={teamClass(home)}>{shortTeamName(home)} {homeWins}승</span>
            {draws ? <span className="text-slate-400"> · {draws}무</span> : null}
          </p>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
            {games.slice(0, 10).map((game: any, index: number) => (
              <div key={`${game.date}-${index}`} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-slate-800 px-3 py-3 last:border-b-0 sm:grid-cols-[1fr_90px]">
                <div className="min-w-0 text-center font-black">
                  <span className={teamClass(game.homeTeam)}>{shortTeamName(game.homeTeam)}</span>
                  <span className="mx-2 text-slate-500">{game.homeScore} : {game.awayScore}</span>
                  <span className={teamClass(game.awayTeam)}>{shortTeamName(game.awayTeam)}</span>
                </div>
                <span className="text-right text-xs text-slate-500">{String(game.date).slice(5)}</span>
              </div>
            ))}
          </div>
        </>
      ) : <p className="mt-4 text-sm text-slate-500">최근 맞대결 기록을 불러오지 못했습니다.</p>}
    </Card>
  );
}


function ResultBadge({ result }: { result: "승" | "패" | "무" }) {
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-black ${
        result === "승"
          ? "border-blue-800 bg-blue-950/40 text-blue-300"
          : result === "패"
            ? "border-red-800 bg-red-950/40 text-red-300"
            : "border-slate-700 bg-slate-900 text-slate-300"
      }`}
    >
      {result}
    </span>
  );
}

function MarketPanel({ away, home, data }: { away: string; home: string; data: any }) {
  const market = data?.market;
  return (
    <Card title="경기 배당">
      {market ? (
        <>
          <p className="mt-2 text-xs text-slate-500">
            {data.bookmaker || "배당사"} 기준 · 경기 전 배당
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-950 p-4">
              <p className="text-xs font-bold text-slate-500">승패</p>
              {market.moneyline ? (
                <div className="mt-3 space-y-2 text-sm font-black">
                  <p className="flex justify-between"><span>{shortTeamName(away)}</span><span>{market.moneyline.away.toFixed(2)}</span></p>
                  <p className="flex justify-between"><span>{shortTeamName(home)}</span><span>{market.moneyline.home.toFixed(2)}</span></p>
                </div>
              ) : <p className="mt-3 text-sm text-slate-500">미발표</p>}
            </div>
            <div className="rounded-xl bg-slate-950 p-4">
              <p className="text-xs font-bold text-slate-500">핸디캡</p>
              {market.handicap ? (
                <div className="mt-3 space-y-2 text-sm font-black">
                  <p className="flex justify-between"><span>{shortTeamName(away)}</span><span>{-market.handicap.line > 0 ? "+" : ""}{-market.handicap.line} · {market.handicap.away.toFixed(2)}</span></p>
                  <p className="flex justify-between"><span>{shortTeamName(home)}</span><span>{market.handicap.line > 0 ? "+" : ""}{market.handicap.line} · {market.handicap.home.toFixed(2)}</span></p>
                </div>
              ) : <p className="mt-3 text-sm text-slate-500">미발표</p>}
            </div>
            <div className="rounded-xl bg-slate-950 p-4">
              <p className="text-xs font-bold text-slate-500">언더·오버</p>
              {market.total ? (
                <div className="mt-3 space-y-2 text-sm font-black">
                  <p className="flex justify-between"><span>언더 {market.total.line}</span><span>{market.total.under.toFixed(2)}</span></p>
                  <p className="flex justify-between"><span>오버 {market.total.line}</span><span>{market.total.over.toFixed(2)}</span></p>
                </div>
              ) : <p className="mt-3 text-sm text-slate-500">미발표</p>}
            </div>
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-slate-500">{data?.message || "배당이 아직 등록되지 않았습니다."}</p>
      )}
    </Card>
  );
}

function WeatherPanel({ data, stadium }: { data: any; stadium: string }) {
  const weather = data?.weather;
  return (
    <Card title="경기장 날씨">
      {weather ? (
        weather.dome ? (
          <p className="mt-4 text-lg font-black">돔구장 · 날씨 영향 적음</p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="기온" value={weather.temperature == null ? "-" : `${weather.temperature}℃`} />
            <Metric label="강수확률" value={weather.precipitation == null ? "-" : `${weather.precipitation}%`} />
            <Metric label="풍속" value={weather.windSpeed == null ? "-" : `${weather.windSpeed}km/h`} />
            <Metric label="풍향" value={weather.windDirection == null ? "-" : `${weather.windDirection}°`} />
          </div>
        )
      ) : (
        <p className="mt-4 text-sm text-slate-500">{data?.message || `${stadium || "구장"} 날씨를 불러오지 못했습니다.`}</p>
      )}
    </Card>
  );
}

function StarterPanel({
  team,
  starter,
  pitcher,
  source,
  detail,
}: {
  team: string;
  starter: string;
  pitcher: any;
  source: string;
  detail?: any;
}) {
  const selected = detail || pitcher;
  return (
    <Card title={`${shortTeamName(team)} 선발투수`}>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-black">{starter || selected?.name || "선발 미정"}</p>
          <p className={`mt-1 text-xs font-bold ${source === "공식 선발" ? "text-blue-300" : "text-amber-300"}`}>
            {source}
          </p>
        </div>
        {selected && (
          <p className="text-sm font-black text-blue-300">
            {selected.wins ?? 0}승 {selected.losses ?? 0}패 · ERA {fmt(selected.era, 2)}
          </p>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="이닝" value={selected?.innings ?? "-"} />
        <Metric label="WHIP" value={fmt(selected?.whip, 2)} />
        <Metric label="볼넷 / 9이닝" value={fmt(selected?.bbPer9, 2)} />
        <Metric label="삼진 / 9이닝" value={fmt(selected?.kPer9, 2)} />
        <Metric label="피안타" value={selected?.hits ?? "-"} />
        <Metric label="피홈런" value={selected?.homeRuns ?? "-"} />
        <Metric label="볼넷" value={selected?.walks ?? "-"} />
        <Metric label="삼진" value={selected?.strikeouts ?? "-"} />
      </div>

      {(detail?.recent10 || detail?.recent5 || detail?.opponent || detail?.stadium || detail?.split) ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Metric label="최근 등판 최대 10경기" value={detail?.recent10?.summary || detail?.recent5?.summary || "등판 기록 없음"} />
          <Metric label="상대팀 상대전적" value={detail?.opponent?.summary || "-"} />
          <Metric label="해당 구장 성적" value={detail?.stadium?.summary || "-"} />
          <Metric label="홈·원정 성적" value={detail?.split?.summary || "-"} />
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
          <p className="text-sm font-black text-slate-300">다음 연결 항목</p>
          <p className="mt-2 text-xs leading-6 text-slate-500">
            최근 등판 최대 10경기 · 상대팀 상대전적 · 구장 성적 · 홈/원정 분할
          </p>
        </div>
      )}

      {detail?.recent10?.gamesDetail?.length ? (
        <div className="mt-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-black text-blue-400">최근 등판 10경기 상세</p>
            <p className="text-xs text-slate-500">날짜 · 상대 · 승패 · 이닝 · 자책 · 볼넷 · 탈삼진 · 투구수</p>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
            {detail.recent10.gamesDetail.map((game: any, index: number) => (
              <div key={`${game.date}-${game.opponent}-${index}`} className="grid grid-cols-[76px_1fr_34px] items-center gap-2 border-b border-slate-800 px-3 py-3 text-sm last:border-b-0 sm:grid-cols-[90px_1fr_42px_72px_65px_65px_65px_70px]">
                <span className="text-xs text-slate-400">{String(game.date).slice(5)} · {game.side === "home" ? "홈" : "원정"}</span>
                <span className="truncate font-bold">vs {shortTeamName(game.opponent)}</span>
                <b className={game.decision === "승" ? "text-blue-400" : game.decision === "패" ? "text-red-400" : "text-slate-500"}>{game.decision || "-"}</b>
                <span className="hidden text-center sm:block">{game.innings}이닝</span>
                <span className="hidden text-center sm:block">{game.earnedRuns}자책</span>
                <span className="hidden text-center sm:block">{game.walks}볼넷</span>
                <span className="hidden text-center sm:block">{game.strikeouts}K</span>
                <span className="hidden text-center sm:block">{game.pitches ? `${game.pitches}구` : "-"}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-500">최근 등판 상세 기록을 불러오지 못했습니다.</div>
      )}

      {!starter && selected && (
        <p className="mt-4 rounded-xl border border-amber-900 bg-amber-950/20 p-3 text-xs leading-6 text-amber-300">
          공식 선발 발표값이 없어 로테이션 후보를 표시합니다. 공식 일정에서 선발이 확인되면 자동으로 교체됩니다.
        </p>
      )}
    </Card>
  );
}

function AdvantageCard({
  title,
  score,
  away,
  home,
}: {
  title: string;
  score: number;
  away: string;
  home: string;
}) {
  const result = advantageLabel(score, away, home);

  return (
    <div className="rounded-2xl bg-slate-950 p-5">
      <p className="text-sm font-bold text-slate-500">{title}</p>
      <p className="mt-3 text-xl tracking-wider text-amber-300">
        {result.stars}
      </p>
      <p className="mt-2 text-lg font-black">{result.team}</p>
      <p className="mt-1 text-sm font-bold text-blue-400">{result.strength}</p>
    </div>
  );
}

function Content() {
  const query = useSearchParams();

  const away = query.get("away") || "원정팀";
  const home = query.get("home") || "홈팀";
  const date = query.get("date") || "";
  const time = query.get("time") || "";
  const stadium = query.get("stadium") || "";
  const awayStarter = query.get("awayStarter") || "";
  const homeStarter = query.get("homeStarter") || "";

  const [data, setData] = useState<any>(null);
  const [marketData, setMarketData] = useState<any>(null);
  const [weatherData, setWeatherData] = useState<any>(null);
  const [scheduleData, setScheduleData] = useState<any>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("종합");

  useEffect(() => {
    const controller = new AbortController();

    async function loadAll() {
      setError("");
      setData(null);

      try {
        const baseOptions = {
          cache: "no-store" as RequestCache,
          signal: controller.signal,
        };

        const [analysisResponse, awayRecentResponse, homeRecentResponse, headToHeadResponse, marketResponse, weatherResponse, scheduleResponse] =
          await Promise.all([
            fetch(dataCacheUrl(`/api/npb/analysis?away=${encodeURIComponent(away)}&home=${encodeURIComponent(home)}&date=${encodeURIComponent(date)}&awayStarter=${encodeURIComponent(awayStarter)}&homeStarter=${encodeURIComponent(homeStarter)}&stadium=${encodeURIComponent(stadium)}&npbPitcherFix=2`, 600), baseOptions),
            fetch(dataCacheUrl(`/api/npb/recent-games-v2?team=${encodeURIComponent(away)}&date=${encodeURIComponent(date)}&limit=10`, 1800), baseOptions),
            fetch(dataCacheUrl(`/api/npb/recent-games-v2?team=${encodeURIComponent(home)}&date=${encodeURIComponent(date)}&limit=10`, 1800), baseOptions),
            fetch(dataCacheUrl(`/api/npb/recent-games-v2?team=${encodeURIComponent(home)}&opponent=${encodeURIComponent(away)}&date=${encodeURIComponent(date)}&limit=10`, 1800), baseOptions),
            fetch(dataCacheUrl(`/api/npb/market?away=${encodeURIComponent(away)}&home=${encodeURIComponent(home)}&date=${encodeURIComponent(date)}`, 600), baseOptions),
            fetch(dataCacheUrl(`/api/npb/weather?stadium=${encodeURIComponent(stadium)}&date=${encodeURIComponent(date)}`, 3600), baseOptions),
            fetch(dataCacheUrl(`/api/npb?date=${encodeURIComponent(date)}`, 300), baseOptions),
          ]);

        const [analysis, awayRecent, homeRecent, headToHead, market, weather, schedule] = await Promise.all([
          analysisResponse.json(),
          awayRecentResponse.json(),
          homeRecentResponse.json(),
          headToHeadResponse.json(),
          marketResponse.json(),
          weatherResponse.json(),
          scheduleResponse.json(),
        ]);
        setMarketData(market);
        setWeatherData(weather);
        setScheduleData(schedule);

        if (!analysisResponse.ok || !analysis.success) {
          throw new Error(analysis.message || "NPB 분석을 불러오지 못했습니다.");
        }

        setData({
          ...analysis,
          awayRecent: awayRecent.success ? awayRecent : null,
          homeRecent: homeRecent.success ? homeRecent : null,
          headToHead: headToHead.success ? headToHead : null,
        });
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === "AbortError") return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "NPB 분석을 불러오지 못했습니다.",
        );
      }
    }

    loadAll();
    return () => controller.abort();
  }, [away, home, date, stadium]);

  const season = data ? advantageLabel(data.scores.season, away, home) : null;
  const batting = data ? advantageLabel(data.scores.batting, away, home) : null;
  const pitching = data
    ? advantageLabel(data.scores.pitching, away, home)
    : null;
  const homeAway = data
    ? advantageLabel(data.scores.homeAway, away, home)
    : null;

  const normalizeTeamName = (value: unknown) =>
    String(value ?? "")
      .replace(/\s+/g, "")
      .replace(/(야구단|베이스볼클럽)$/g, "")
      .toLowerCase();
  const scheduledGame = scheduleData?.games?.find((game: any) => {
    const gameAway = normalizeTeamName(game?.away);
    const gameHome = normalizeTeamName(game?.home);
    const pageAway = normalizeTeamName(away);
    const pageHome = normalizeTeamName(home);
    return (
      (gameAway === pageAway || gameAway.includes(pageAway) || pageAway.includes(gameAway)) &&
      (gameHome === pageHome || gameHome.includes(pageHome) || pageHome.includes(gameHome))
    );
  });
  const resolvedAwayStarter =
    awayStarter || scheduledGame?.awayStarter || data?.awayRotation?.[0]?.name || "";
  const resolvedHomeStarter =
    homeStarter || scheduledGame?.homeStarter || data?.homeRotation?.[0]?.name || "";
  const awayStarterPitcher =
    data?.awayRotation?.find((pitcher: any) => pitcher.name === resolvedAwayStarter) ||
    data?.awayRotation?.[0] ||
    null;
  const homeStarterPitcher =
    data?.homeRotation?.find((pitcher: any) => pitcher.name === resolvedHomeStarter) ||
    data?.homeRotation?.[0] ||
    null;
  const awayStarterSource =
    awayStarter || scheduledGame?.awayStarter ? "공식 선발" : resolvedAwayStarter ? "로테이션 1순위 후보" : "발표 전";
  const homeStarterSource =
    homeStarter || scheduledGame?.homeStarter ? "공식 선발" : resolvedHomeStarter ? "로테이션 1순위 후보" : "발표 전";

  useEffect(() => {
    if (!data || error) return;
    savePregamePrediction({
      league: "NPB",
      date,
      time,
      away,
      home,
      pick: data.pick,
      awayRate: Number(data.probability?.away ?? 50),
      homeRate: Number(data.probability?.home ?? 50),
      confidence: Number(data.confidence ?? 50),
    });
  }, [data, error, date, time, away, home]);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-6xl justify-between px-5 py-5">
          <Link href="/" className="text-2xl font-black">
            Sports AI
          </Link>
          <Link href="/" className="text-sm font-black text-blue-400">
            ← 경기 목록
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-7">
          <p className="text-sm font-black text-blue-400">
            NPB 경기 상세 분석 · 전문가 리포트 v26
          </p>
          <h1 className="mt-3 text-3xl font-black">
            {away} 대 {home}
          </h1>
          <p className="mt-3 text-sm text-slate-400">
            {date} {time} · {stadium || "경기장 미정"} · 한국시간
          </p>
        </div>

        {error && (
          <p className="mt-6 rounded-xl border border-red-900 bg-red-950/30 p-4 text-red-300">
            {error}
          </p>
        )}

        {!data && !error && (
          <p className="mt-6 text-slate-400">
            공식 기록을 불러와 분석 중입니다.
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-2">{["종합","선발","최근경기","맞대결","불펜","배당"].map((tab)=><button key={tab} type="button" onClick={()=>setActiveTab(tab)} className={`rounded-xl border px-4 py-2 text-sm font-black ${activeTab===tab?"border-blue-500 bg-blue-600 text-white":"border-slate-700 bg-slate-900 text-slate-300"}`}>{tab}</button>)}</div>

        {activeTab==="배당" && <div className="mt-6">
          <MarketPanel away={away} home={home} data={marketData} />
        </div>}

        {activeTab==="종합" && <div className="mt-6">
          <WeatherPanel data={weatherData} stadium={stadium} />
        </div>}

        {activeTab==="선발" && <div className="mt-6 grid gap-5 md:grid-cols-2">
          <StarterPanel
            team={away}
            starter={resolvedAwayStarter}
            pitcher={awayStarterPitcher}
            source={awayStarterSource}
            detail={data?.awayStarterDetail}
          />
          <StarterPanel
            team={home}
            starter={resolvedHomeStarter}
            pitcher={homeStarterPitcher}
            source={homeStarterSource}
            detail={data?.homeStarterDetail}
          />
        </div>}

        {activeTab==="종합" && <div className="mt-6 grid gap-5 md:grid-cols-2">
          <TeamPanel
            name={away}
            standing={data?.awayStanding}
            batting={data?.awayBatting}
            pitching={data?.awayPitching}
            side="away"
          />
          <TeamPanel
            name={home}
            standing={data?.homeStanding}
            batting={data?.homeBatting}
            pitching={data?.homePitching}
            side="home"
          />
        </div>}

        {activeTab==="최근경기" && <div className="mt-6 grid gap-5 md:grid-cols-2">
          <RecentPanel title={`${away} 최근 10경기`} data={data?.awayRecent} />
          <RecentPanel title={`${home} 최근 10경기`} data={data?.homeRecent} />
        </div>}

        {activeTab==="맞대결" && <div className="mt-6">
          <HeadToHeadPanel away={away} home={home} data={data?.headToHead} />
        </div>}

        {activeTab==="선발" && <div className="mt-6 grid gap-5 md:grid-cols-2">
          <Card title={`${away} 선발·로테이션`}>
            <p className="mt-2 text-sm text-slate-400">
              공식 선발: <b className="text-white">{resolvedAwayStarter || "미정"}</b>
            </p>
            <PitcherTable items={data?.awayRotation || []} />
          </Card>

          <Card title={`${home} 선발·로테이션`}>
            <p className="mt-2 text-sm text-slate-400">
              공식 선발: <b className="text-white">{resolvedHomeStarter || "미정"}</b>
            </p>
            <PitcherTable items={data?.homeRotation || []} />
          </Card>
        </div>}

        {activeTab==="불펜" && <div className="mt-6 grid gap-5 md:grid-cols-2">
          <Card title={`${away} 불펜 핵심`}>
            <PitcherTable items={data?.awayBullpen || []} />
          </Card>
          <Card title={`${home} 불펜 핵심`}>
            <PitcherTable items={data?.homeBullpen || []} />
          </Card>
        </div>}

        {activeTab==="종합" && <div className="mt-6">
          <Card title="AI 비교 분석">
            {data && (
              <>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <AdvantageCard
                    title="시즌 전력"
                    score={data.scores.season}
                    away={away}
                    home={home}
                  />
                  <AdvantageCard
                    title="타선"
                    score={data.scores.batting}
                    away={away}
                    home={home}
                  />
                  <AdvantageCard
                    title="투수력"
                    score={data.scores.pitching}
                    away={away}
                    home={home}
                  />
                  <AdvantageCard
                    title="홈·원정"
                    score={data.scores.homeAway}
                    away={away}
                    home={home}
                  />
                  <AdvantageCard
                    title="최근 흐름"
                    score={data.scores.recent ?? 0}
                    away={away}
                    home={home}
                  />
                  <AdvantageCard
                    title="상대전적"
                    score={data.scores.headToHead ?? 0}
                    away={away}
                    home={home}
                  />
                </div>

                <div className="mt-6 space-y-4">
                  {[
                    data.expertAnalysis?.starterMatchup,
                    data.expertAnalysis?.batting,
                    data.expertAnalysis?.bullpen,
                    data.expertAnalysis?.homeAway,
                    data.expertAnalysis?.recentForm,
                    data.expertAnalysis?.matchup,
                    data.expertAnalysis?.keyPoint,
                  ]
                    .filter(Boolean)
                    .map((section: any, index: number) => (
                      <article
                        key={section.title}
                        className="rounded-2xl border border-slate-800 bg-slate-950 p-5"
                      >
                        <div className="flex gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-950 text-sm font-black text-blue-400">
                            {index + 1}
                          </span>
                          <div>
                            <h3 className="font-black text-white">{section.title}</h3>
                            <p className="mt-3 text-sm leading-7 text-slate-300">
                              {section.text}
                            </p>
                          </div>
                        </div>
                      </article>
                    ))}
                </div>

                <div className="mt-6 rounded-2xl border border-blue-800 bg-blue-950/20 p-6">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="text-sm font-black text-blue-400">
                        AI 최종 추천
                      </p>
                      <h2 className="mt-2 text-3xl font-black">
                        {data.pick} 승
                      </h2>
                      <p className="mt-2 text-lg tracking-widest text-amber-300">
                        {data.confidence >= 75
                          ? "★★★★★"
                          : data.confidence >= 65
                            ? "★★★★☆"
                            : data.confidence >= 55
                              ? "★★★☆☆"
                              : "★★☆☆☆"}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm text-slate-400">예상 승률</p>
                      <p className="mt-1 text-3xl font-black text-blue-400">
                        {data.pick === home
                          ? data.probability.home
                          : data.probability.away}
                        %
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-400">
                        신뢰도 {data.confidence}점
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex justify-between text-sm font-black">
                    <span>
                      {away} {data.probability.away}%
                    </span>
                    <span>
                      {home} {data.probability.home}%
                    </span>
                  </div>

                  <div className="mt-3 flex h-4 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="bg-slate-500"
                      style={{ width: `${data.probability.away}%` }}
                    />
                    <div
                      className="bg-blue-600"
                      style={{ width: `${data.probability.home}%` }}
                    />
                  </div>
                </div>

                {data.expertAnalysis?.finalOutlook && (
                  <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950 p-5">
                    <p className="text-sm font-black text-blue-400">
                      {data.expertAnalysis.finalOutlook.title}
                    </p>
                    <p className="mt-3 text-sm leading-7 text-slate-300">
                      {data.expertAnalysis.finalOutlook.text}
                    </p>
                  </div>
                )}

                {data.expertAnalysis?.cautions?.length > 0 && (
                  <div className="mt-5 rounded-2xl border border-amber-900/60 bg-amber-950/10 p-5">
                    <p className="text-sm font-black text-amber-400">분석 시 주의 변수</p>
                    <div className="mt-3 space-y-2 text-sm leading-6 text-slate-400">
                      {data.expertAnalysis.cautions.map((item: string, index: number) => (
                        <p key={index}>• {item}</p>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>}

        {activeTab==="종합" && <div className="mt-6">
          <Card title="분석 데이터 안내">
            <p className="mt-3 text-sm leading-7 text-slate-400">
              현재 전문가 리포트는 시즌 순위·승률, 팀 타격, 팀 투수력, 선발 기록,
              최근 10경기, 상대전적, 홈·원정 성적을 종합해 자동 생성합니다.
              경기 당일 라인업과 최근 3일 불펜 투구 수는 다음 단계에서 추가 반영합니다.
            </p>
          </Card>
        </div>}
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-950 p-10 text-white">
          불러오는 중...
        </main>
      }
    >
      <Content />
    </Suspense>
  );
}
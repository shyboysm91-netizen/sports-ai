"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { dataCacheUrl } from "../lib/client-data-cache";

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

  return (
    <Card title={shortTeamName(title.replace(" 최근 10경기", "")) + " 최근 10경기"}>
      {summary?.games ? (
        <>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Metric
              label="승-패-무"
              value={`${summary.wins}승 ${summary.losses}패 ${summary.draws}무`}
            />
            <Metric label="평균 득점" value={fmt(summary.averageRunsFor, 2)} />
            <Metric
              label="평균 실점"
              value={fmt(summary.averageRunsAgainst, 2)}
            />
          </div>

          <div className="mt-4 space-y-2">
            {games.slice(0, 5).map((game: any) => {
              const homeTeam = shortTeamName(game.homeTeam);
              const awayTeam = shortTeamName(game.awayTeam);
              const hasFullMatch =
                game.homeTeam &&
                game.awayTeam &&
                Number.isFinite(game.homeScore) &&
                Number.isFinite(game.awayScore);

              return (
                <div
                  key={`${game.date}-${game.homeTeam || game.opponent}-${game.score}`}
                  className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-black">
                        {hasFullMatch ? (
                          <>
                            {homeTeam} {game.homeScore}
                            <span className="mx-2 text-slate-600">:</span>
                            {game.awayScore} {awayTeam}
                          </>
                        ) : (
                          <>
                            {shortTeamName(data?.team)} {game.runsFor}
                            <span className="mx-2 text-slate-600">:</span>
                            {game.runsAgainst} {shortTeamName(game.opponent)}
                          </>
                        )}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {game.date} · {game.venue || "구장 정보 없음"}
                      </p>
                    </div>

                    <span
                      className={`rounded-md border px-2.5 py-1 text-xs font-black ${
                        game.result === "승"
                          ? "border-emerald-900 text-emerald-400"
                          : game.result === "패"
                            ? "border-red-900 text-red-400"
                            : "border-slate-700 text-slate-400"
                      }`}
                    >
                      {game.result}
                    </span>
                  </div>
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

function HeadToHeadPanel({
  away,
  home,
  data,
}: {
  away: string;
  home: string;
  data: any;
}) {
  const summary = data?.summary;
  const games = data?.games || [];
  const homeWins = summary?.wins ?? 0;
  const awayWins = summary?.losses ?? 0;
  const draws = summary?.draws ?? 0;

  return (
    <Card title={`${away} vs ${home} 최근 맞대결`}>
      {summary?.games ? (
        <>
          <p className="mt-3 text-xs text-slate-500">
            아래 기록은 홈팀인 {home} 기준으로 집계한 최근 {summary.games}경기입니다.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Metric
              label="맞대결 성적"
              value={`${shortTeamName(away)} ${awayWins}승 · ${shortTeamName(home)} ${homeWins}승${draws ? ` · ${draws}무` : ""}`}
            />
            <Metric
              label={`${shortTeamName(away)} 평균 득점`}
              value={fmt(summary.averageRunsAgainst, 2)}
            />
            <Metric
              label={`${shortTeamName(home)} 평균 득점`}
              value={fmt(summary.averageRunsFor, 2)}
            />
          </div>

          <div className="mt-4 space-y-2">
            {games.slice(0, 10).map((game: any) => (
              <div
                key={`${game.date}-${game.homeTeam}-${game.awayTeam}-${game.homeScore}-${game.awayScore}`}
                className="rounded-xl bg-slate-950 px-4 py-4 text-sm"
              >
                <div className="grid gap-3 md:grid-cols-[92px_1fr_auto] md:items-center">
                  <p className="text-xs text-slate-500">{game.date}</p>

                  <div>
                    <p className="font-black flex items-center gap-2 flex-wrap">
<span className={`rounded px-2 py-0.5 text-xs font-black ${game.homeScore>game.awayScore?"bg-blue-600 text-white":game.homeScore<game.awayScore?"bg-red-600 text-white":"bg-slate-600 text-white"}`}>{game.homeScore>game.awayScore?"승":game.homeScore<game.awayScore?"패":"무"}</span>
{shortTeamName(game.homeTeam)} {game.homeScore}<span className="mx-2 text-slate-600">:</span>{game.awayScore} {shortTeamName(game.awayTeam)}
<span className={`rounded px-2 py-0.5 text-xs font-black ${game.awayScore>game.homeScore?"bg-blue-600 text-white":game.awayScore<game.homeScore?"bg-red-600 text-white":"bg-slate-600 text-white"}`}>{game.awayScore>game.homeScore?"승":game.awayScore<game.homeScore?"패":"무"}</span>
</p>
<p className="mt-2 text-xs text-slate-500">홈 {shortTeamName(game.homeTeam)} · 원정 {shortTeamName(game.awayTeam)} · 구장: {game.venue || "구장 정보 없음"}</p>
</div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          최근 맞대결 기록을 불러오지 못했습니다.
        </p>
      )}
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

      {(detail?.recent5 || detail?.opponent || detail?.stadium || detail?.split) ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Metric label="최근 5경기" value={detail?.recent5?.summary || "-"} />
          <Metric label="상대팀 상대전적" value={detail?.opponent?.summary || "-"} />
          <Metric label="해당 구장 성적" value={detail?.stadium?.summary || "-"} />
          <Metric label="홈·원정 성적" value={detail?.split?.summary || "-"} />
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
          <p className="text-sm font-black text-slate-300">다음 연결 항목</p>
          <p className="mt-2 text-xs leading-6 text-slate-500">
            최근 5경기 · 상대팀 상대전적 · 구장 성적 · 홈/원정 분할
          </p>
        </div>
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
            fetch(dataCacheUrl(`/api/npb/analysis?away=${encodeURIComponent(away)}&home=${encodeURIComponent(home)}&date=${encodeURIComponent(date)}&awayStarter=${encodeURIComponent(awayStarter)}&homeStarter=${encodeURIComponent(homeStarter)}&stadium=${encodeURIComponent(stadium)}`, 600), baseOptions),
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

  const scheduledGame = scheduleData?.games?.find(
    (game: any) => game.away === away && game.home === home,
  );
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

        <div className="mt-6">
          <MarketPanel away={away} home={home} data={marketData} />
        </div>

        <div className="mt-6">
          <WeatherPanel data={weatherData} stadium={stadium} />
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
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
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
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
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <RecentPanel title={`${away} 최근 10경기`} data={data?.awayRecent} />
          <RecentPanel title={`${home} 최근 10경기`} data={data?.homeRecent} />
        </div>

        <div className="mt-6">
          <HeadToHeadPanel away={away} home={home} data={data?.headToHead} />
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
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
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <Card title={`${away} 불펜 핵심`}>
            <PitcherTable items={data?.awayBullpen || []} />
          </Card>
          <Card title={`${home} 불펜 핵심`}>
            <PitcherTable items={data?.homeBullpen || []} />
          </Card>
        </div>

        <div className="mt-6">
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
        </div>

        <div className="mt-6">
          <Card title="분석 데이터 안내">
            <p className="mt-3 text-sm leading-7 text-slate-400">
              현재 전문가 리포트는 시즌 순위·승률, 팀 타격, 팀 투수력, 선발 기록,
              최근 10경기, 상대전적, 홈·원정 성적을 종합해 자동 생성합니다.
              경기 당일 라인업과 최근 3일 불펜 투구 수는 다음 단계에서 추가 반영합니다.
            </p>
          </Card>
        </div>
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
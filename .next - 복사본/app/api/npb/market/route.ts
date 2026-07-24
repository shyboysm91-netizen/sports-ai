import { NextResponse } from "next/server";

type ApiOutcome = {
  name?: string;
  price?: number;
  point?: number;
};

type ApiMarket = {
  key?: "h2h" | "spreads" | "totals" | string;
  last_update?: string;
  outcomes?: ApiOutcome[];
};

type ApiBookmaker = {
  key?: string;
  title?: string;
  last_update?: string;
  markets?: ApiMarket[];
};

type ApiEvent = {
  id?: string;
  commence_time?: string;
  home_team?: string;
  away_team?: string;
  bookmakers?: ApiBookmaker[];
};

type MarketResponse = {
  success: boolean;
  status: "received" | "unavailable" | "error";
  message?: string;
  bookmaker?: string;
  bookmakerCount?: number;
  lastUpdate?: string;
  commenceTime?: string;
  marketState?: "pregame" | "live";
  actualAway?: string;
  actualHome?: string;
  matchMode?: "exact" | "time_fallback";
  remaining?: string | null;
  used?: string | null;
  market: {
    moneyline: { away: number; home: number } | null;
    handicap: { line: number; away: number; home: number } | null;
    total: { line: number; under: number; over: number } | null;
    history: {
      moneyline: Array<{ at: string; away?: number; home?: number }>;
      handicap: Array<{ at: string; away?: number; home?: number; line?: number }>;
      total: Array<{ at: string; under?: number; over?: number; line?: number }>;
    };
  } | null;
};

const TEAM_ALIASES: Record<string, string[]> = {
  "한신 타이거스": ["hanshin tigers", "hanshin", "한신", "한신 타이거즈"],
  "요미우리 자이언츠": ["yomiuri giants", "yomiuri", "요미우리"],
  "요코하마 DeNA 베이스타스": [
    "yokohama dena baystars",
    "yokohama baystars",
    "dena baystars",
    "dena",
    "요코하마",
    "요코하마 dena 베이스타즈"
  ],
  "주니치 드래건스": ["chunichi dragons", "chunichi", "주니치"],
  "히로시마 도요 카프": ["hiroshima toyo carp", "hiroshima carp", "hiroshima", "히로시마"],
  "도쿄 야쿠르트 스왈로스": ["tokyo yakult swallows", "yakult swallows", "yakult", "야쿠르트"],
  "후쿠오카 소프트뱅크 호크스": [
    "fukuoka softbank hawks",
    "softbank hawks",
    "softbank",
    "소프트뱅크"
  ],
  "홋카이도 닛폰햄 파이터스": [
    "hokkaido nippon-ham fighters",
    "hokkaido nippon ham fighters",
    "nippon-ham fighters",
    "nippon ham fighters",
    "닛폰햄",
    "홋카이도 닛폰햄 파이터즈"
  ],
  "도호쿠 라쿠텐 골든이글스": [
    "tohoku rakuten golden eagles",
    "rakuten golden eagles",
    "rakuten eagles",
    "rakuten",
    "라쿠텐"
  ],
  "지바 롯데 마린스": [
    "chiba lotte marines",
    "lotte marines",
    "chiba lotte",
    "지바롯데",
    "치바롯데",
    "치바 롯데 마린스"
  ],
  "사이타마 세이부 라이온스": [
    "saitama seibu lions",
    "seibu lions",
    "seibu",
    "세이부",
    "사이타마 세이부 라이온즈"
  ],
  "오릭스 버팔로스": ["orix buffaloes", "orix", "오릭스"],
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
}

function canonicalTeam(value: string) {
  const compact = normalize(value);
  for (const [team, aliases] of Object.entries(TEAM_ALIASES)) {
    if ([team, ...aliases].some((alias) => normalize(alias) === compact)) return team;
  }
  return value.trim();
}

function kstDayRangeIso(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return null;

  // 한국 날짜 00:00~23:59를 UTC 범위로 변환합니다.
  // The Odds API는 밀리초가 없는 YYYY-MM-DDTHH:mm:ssZ 형식을 요구합니다.
  const start = new Date(Date.UTC(year, month - 1, day, -9, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, day, 14, 59, 59));
  const cleanIso = (value: Date) => value.toISOString().replace(/\.\d{3}Z$/, "Z");

  return { start: cleanIso(start), end: cleanIso(end) };
}

function market(bookmaker: ApiBookmaker, key: string) {
  return bookmaker.markets?.find((item) => item.key === key);
}

function outcome(marketValue: ApiMarket | undefined, name: string) {
  const target = canonicalTeam(name);
  return marketValue?.outcomes?.find((item) => canonicalTeam(item.name ?? "") === target);
}

function totalOutcome(marketValue: ApiMarket | undefined, name: "Over" | "Under") {
  return marketValue?.outcomes?.find(
    (item) => (item.name ?? "").toLowerCase() === name.toLowerCase(),
  );
}

function positiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 1;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function validMoneylinePair(away: number, home: number) {
  if (!positiveNumber(away) || !positiveNumber(home)) return false;
  if (away < 1.08 || home < 1.08 || away > 6 || home > 6) return false;

  const awayRaw = 1 / away;
  const homeRaw = 1 / home;
  const overround = awayRaw + homeRaw;
  if (overround < 0.98 || overround > 1.18) return false;

  const awayNoVig = awayRaw / overround;
  const homeNoVig = homeRaw / overround;
  // 극단적인 단일 업체 값은 화면에 노출하지 않습니다.
  return Math.max(awayNoVig, homeNoVig) <= 0.82;
}

function validNpbTotalLine(value: number) {
  return Number.isFinite(value) && value >= 4.5 && value <= 12.5;
}

function validNpbSpreadLine(value: number) {
  return Number.isFinite(value) && Math.abs(value) >= 0.5 && Math.abs(value) <= 3.5;
}

function mostCommonLine<T extends { line: number }>(rows: T[]) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = row.line.toFixed(1);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length || Number(a[0]) - Number(b[0]))[0]?.[1] ?? [];
}

function consensusMarket(event: ApiEvent, awayApi: string, homeApi: string) {
  const trustedPriority = [
    "fanduel",
    "draftkings",
    "betmgm",
    "williamhill_us",
    "caesars",
    "espnbet",
    "betrivers",
    "betonlineag",
    "bovada",
  ];
  const excluded = new Set([
    "betfair_ex_uk",
    "betfair_ex_eu",
    "matchbook",
    "smarkets",
    "polymarket",
    "predictit",
  ]);

  type Snapshot = {
    bookmaker: ApiBookmaker;
    awayMoney: number;
    homeMoney: number;
    spreadLine: number | null;
    awaySpreadPrice: number | null;
    homeSpreadPrice: number | null;
    totalLine: number | null;
    overPrice: number | null;
    underPrice: number | null;
  };

  const snapshots: Snapshot[] = [];
  for (const bookmaker of event.bookmakers ?? []) {
    if (excluded.has(bookmaker.key ?? "")) continue;

    const h2h = market(bookmaker, "h2h");
    const awayMoney = outcome(h2h, awayApi)?.price;
    const homeMoney = outcome(h2h, homeApi)?.price;
    if (!validMoneylinePair(awayMoney ?? 0, homeMoney ?? 0)) continue;

    const spreads = market(bookmaker, "spreads");
    const awaySpread = outcome(spreads, awayApi);
    const homeSpread = outcome(spreads, homeApi);
    const spreadValid =
      finiteNumber(awaySpread?.point) &&
      finiteNumber(homeSpread?.point) &&
      awaySpread.point === -homeSpread.point &&
      validNpbSpreadLine(homeSpread.point) &&
      positiveNumber(awaySpread.price) &&
      positiveNumber(homeSpread.price);

    const totals = market(bookmaker, "totals");
    const over = totalOutcome(totals, "Over");
    const under = totalOutcome(totals, "Under");
    const totalValid =
      finiteNumber(over?.point) &&
      finiteNumber(under?.point) &&
      over.point === under.point &&
      validNpbTotalLine(over.point) &&
      positiveNumber(over.price) &&
      positiveNumber(under.price);

    snapshots.push({
      bookmaker,
      awayMoney: awayMoney!,
      homeMoney: homeMoney!,
      spreadLine: spreadValid ? homeSpread!.point! : null,
      awaySpreadPrice: spreadValid ? awaySpread!.price! : null,
      homeSpreadPrice: spreadValid ? homeSpread!.price! : null,
      totalLine: totalValid ? over!.point! : null,
      overPrice: totalValid ? over!.price! : null,
      underPrice: totalValid ? under!.price! : null,
    });
  }

  const trusted = snapshots
    .filter((row) => trustedPriority.includes(row.bookmaker.key ?? ""))
    .sort(
      (a, b) =>
        trustedPriority.indexOf(a.bookmaker.key ?? "") -
        trustedPriority.indexOf(b.bookmaker.key ?? ""),
    );

  // 신뢰 스포츠북이 하나라도 있으면 우선 사용하고, 없으면 일반 스포츠북 전체를 사용합니다.
  const selected = trusted.length ? trusted : snapshots;
  const moneyline = selected.length
    ? {
        away: median(selected.map((row) => row.awayMoney)) as number,
        home: median(selected.map((row) => row.homeMoney)) as number,
      }
    : null;

  const spreadRows = selected
    .filter(
      (row) =>
        row.spreadLine != null &&
        row.awaySpreadPrice != null &&
        row.homeSpreadPrice != null,
    )
    .map((row) => ({
      line: row.spreadLine as number,
      away: row.awaySpreadPrice as number,
      home: row.homeSpreadPrice as number,
      bookmaker: row.bookmaker,
    }));
  const commonSpreads = mostCommonLine(spreadRows);
  const handicap = commonSpreads.length
    ? {
        line: commonSpreads[0].line,
        away: median(commonSpreads.map((row) => row.away)) as number,
        home: median(commonSpreads.map((row) => row.home)) as number,
      }
    : null;

  const totalRows = selected
    .filter(
      (row) =>
        row.totalLine != null && row.overPrice != null && row.underPrice != null,
    )
    .map((row) => ({
      line: row.totalLine as number,
      over: row.overPrice as number,
      under: row.underPrice as number,
      bookmaker: row.bookmaker,
    }));
  const commonTotals = mostCommonLine(totalRows);
  const total = commonTotals.length
    ? {
        line: commonTotals[0].line,
        over: median(commonTotals.map((row) => row.over)) as number,
        under: median(commonTotals.map((row) => row.under)) as number,
      }
    : null;

  const updates = selected
    .flatMap((row) => [
      row.bookmaker.last_update,
      ...(row.bookmaker.markets ?? []).map((item) => item.last_update),
    ])
    .filter((value): value is string => Boolean(value))
    .sort();

  const sourceNames = selected
    .map((row) => row.bookmaker.title ?? row.bookmaker.key ?? "Sportsbook")
    .filter(Boolean);

  return {
    usableCount: selected.length,
    moneyline,
    handicap,
    total,
    lastUpdate: updates.at(-1),
    sourceLabel:
      sourceNames.length === 1
        ? sourceNames[0]
        : trusted.length
          ? `미국 스포츠북 ${sourceNames.length}곳 중앙값`
          : `일반 스포츠북 ${sourceNames.length}곳 중앙값`,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date")?.trim() ?? "";
  const requestedAway = searchParams.get("away")?.trim() ?? "";
  const requestedHome = searchParams.get("home")?.trim() ?? "";
  const requestedCommenceTime = searchParams.get("commenceTime")?.trim() ?? "";
  const sportKey =
    searchParams.get("league")?.toUpperCase() === "MLB"
      ? "baseball_mlb"
      : "baseball_kbo";

  if (!date || !requestedAway || !requestedHome) {
    return NextResponse.json<MarketResponse>(
      {
        success: false,
        status: "error",
        message: "date, away, home 값이 필요합니다.",
        market: null,
      },
      { status: 400 },
    );
  }

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    return NextResponse.json<MarketResponse>(
      {
        success: false,
        status: "error",
        message: ".env.local에 ODDS_API_KEY가 없습니다.",
        market: null,
      },
      { status: 500 },
    );
  }

  const range = kstDayRangeIso(date);
  if (!range) {
    return NextResponse.json<MarketResponse>(
      {
        success: false,
        status: "error",
        message: "날짜 형식은 YYYY-MM-DD여야 합니다.",
        market: null,
      },
      { status: 400 },
    );
  }

  const baseParams = new URLSearchParams({
    apiKey,
    regions: "eu",
    markets: "h2h,spreads,totals",
    oddsFormat: "decimal",
    dateFormat: "iso",
  });

  let remaining: string | null = null;
  let used: string | null = null;

  async function requestEvents(params: URLSearchParams) {
    const response = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?${params.toString()}`,
      { next: { revalidate: 1800 } },
    );

    remaining = response.headers.get("x-requests-remaining") ?? remaining;
    used = response.headers.get("x-requests-used") ?? used;

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `The Odds API 오류 (${response.status})${detail ? `: ${detail}` : ""}`,
      );
    }

    return (await response.json()) as ApiEvent[];
  }

  try {
    const datedParams = new URLSearchParams(baseParams);
    datedParams.set("commenceTimeFrom", range.start);
    datedParams.set("commenceTimeTo", range.end);

    // 1차: 선택한 한국 날짜의 경기 전/예정 배당 조회
    const datedEvents = await requestEvents(datedParams);

    const away = canonicalTeam(requestedAway);
    const home = canonicalTeam(requestedHome);
    const requestedTimeMs = requestedCommenceTime
      ? Date.parse(requestedCommenceTime)
      : Number.NaN;

    const nearestByTime = (rows: ApiEvent[]) =>
      Number.isFinite(requestedTimeMs)
        ? [...rows].sort((a, b) => {
            const aTime = Date.parse(a.commence_time ?? "");
            const bTime = Date.parse(b.commence_time ?? "");
            return (
              Math.abs(aTime - requestedTimeMs) -
              Math.abs(bTime - requestedTimeMs)
            );
          })[0]
        : rows.length === 1
          ? rows[0]
          : undefined;

    const findEvent = (events: ApiEvent[]) => {
      const exact = events.filter(
        (item) =>
          canonicalTeam(item.away_team ?? "") === away &&
          canonicalTeam(item.home_team ?? "") === home,
      );

      let found = nearestByTime(exact);
      let mode: "exact" | "time_fallback" = "exact";

      const foundTime = Date.parse(found?.commence_time ?? "");
      if (
        found &&
        Number.isFinite(requestedTimeMs) &&
        (!Number.isFinite(foundTime) ||
          Math.abs(foundTime - requestedTimeMs) > 6 * 60 * 60 * 1000)
      ) {
        found = undefined;
      }

      if (!found && Number.isFinite(requestedTimeMs)) {
        const oneTeamMatches = events.filter((item) => {
          const itemAway = canonicalTeam(item.away_team ?? "");
          const itemHome = canonicalTeam(item.home_team ?? "");
          const sameTeam =
            itemAway === away ||
            itemHome === away ||
            itemAway === home ||
            itemHome === home;
          const itemTime = Date.parse(item.commence_time ?? "");
          return (
            sameTeam &&
            Number.isFinite(itemTime) &&
            Math.abs(itemTime - requestedTimeMs) <= 3 * 60 * 60 * 1000
          );
        });

        const fallback = nearestByTime(oneTeamMatches);
        if (fallback) {
          found = fallback;
          mode = "time_fallback";
        }
      }

      return { event: found, matchMode: mode };
    };

    let { event, matchMode } = findEvent(datedEvents);

    if (!event) {
      return NextResponse.json<MarketResponse>({
        success: false,
        status: "unavailable",
        message: `${date} ${requestedAway} vs ${requestedHome} 경기의 경기 전 배당이 아직 등록되지 않았습니다.`,
        remaining,
        used,
        market: null,
      });
    }

    const awayApi = event.away_team ?? requestedAway;
    const homeApi = event.home_team ?? requestedHome;
    const consensus = consensusMarket(event, awayApi, homeApi);

    if (!consensus.moneyline) {
      return NextResponse.json<MarketResponse>({
        success: false,
        status: "unavailable",
        message: "경기는 찾았지만 현재 제공되는 승패 배당이 없습니다.",
        remaining,
        used,
        market: null,
      });
    }

    const commenceMs = Date.parse(event.commence_time ?? "");
    const marketState =
      Number.isFinite(commenceMs) && Date.now() >= commenceMs
        ? "live"
        : "pregame";

    return NextResponse.json<MarketResponse>({
      success: true,
      status: "received",
      bookmaker: consensus.sourceLabel,
      bookmakerCount: consensus.usableCount,
      lastUpdate: consensus.lastUpdate,
      commenceTime: event.commence_time,
      marketState,
      actualAway: awayApi,
      actualHome: homeApi,
      matchMode,
      remaining,
      used,
      market: {
        moneyline: consensus.moneyline,
        handicap: consensus.handicap,
        total: consensus.total,
        history: { moneyline: [], handicap: [], total: [] },
      },
    });
  } catch (error) {
    return NextResponse.json<MarketResponse>(
      {
        success: false,
        status: "error",
        message:
          error instanceof Error ? error.message : "배당 수신에 실패했습니다.",
        remaining,
        used,
        market: null,
      },
      { status: 500 },
    );
  }
}

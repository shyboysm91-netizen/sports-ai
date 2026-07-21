import { NextResponse } from "next/server";

export const revalidate = 1800;

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
  eventAway?: string;
  eventHome?: string;
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
  "Arizona Diamondbacks": ["arizona diamondbacks"],
  "Atlanta Braves": ["atlanta braves"],
  "Baltimore Orioles": ["baltimore orioles"],
  "Boston Red Sox": ["boston red sox"],
  "Chicago Cubs": ["chicago cubs"],
  "Chicago White Sox": ["chicago white sox"],
  "Cincinnati Reds": ["cincinnati reds"],
  "Cleveland Guardians": ["cleveland guardians"],
  "Colorado Rockies": ["colorado rockies"],
  "Detroit Tigers": ["detroit tigers"],
  "Houston Astros": ["houston astros"],
  "Kansas City Royals": ["kansas city royals"],
  "Los Angeles Angels": ["los angeles angels"],
  "Los Angeles Dodgers": ["los angeles dodgers"],
  "Miami Marlins": ["miami marlins"],
  "Milwaukee Brewers": ["milwaukee brewers"],
  "Minnesota Twins": ["minnesota twins"],
  "New York Mets": ["new york mets"],
  "New York Yankees": ["new york yankees"],
  "Athletics": ["athletics", "oakland athletics"],
  "Philadelphia Phillies": ["philadelphia phillies"],
  "Pittsburgh Pirates": ["pittsburgh pirates"],
  "San Diego Padres": ["san diego padres"],
  "San Francisco Giants": ["san francisco giants"],
  "Seattle Mariners": ["seattle mariners"],
  "St. Louis Cardinals": ["st. louis cardinals", "st louis cardinals"],
  "Tampa Bay Rays": ["tampa bay rays"],
  "Texas Rangers": ["texas rangers"],
  "Toronto Blue Jays": ["toronto blue jays"],
  "Washington Nationals": ["washington nationals"],
  "KIA 타이거즈": ["kia tigers", "kia", "기아 타이거즈", "기아", "kia타이거즈"],
  "삼성 라이온즈": ["samsung lions", "samsung", "삼성"],
  "LG 트윈스": ["lg twins", "lg", "엘지 트윈스", "엘지"],
  "두산 베어스": ["doosan bears", "doosan", "두산"],
  "KT 위즈": ["kt wiz", "kt", "케이티 위즈", "케이티"],
  "SSG 랜더스": ["ssg landers", "ssg", "에스에스지 랜더스"],
  "롯데 자이언츠": ["lotte giants", "lotte", "롯데"],
  "한화 이글스": ["hanwha eagles", "hanwha", "한화"],
  "NC 다이노스": ["nc dinos", "nc", "엔씨 다이노스", "엔씨"],
  "키움 히어로즈": ["kiwoom heroes", "kiwoom", "키움"],
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

function validMlbTotalLine(value: number) {
  return Number.isFinite(value) && value >= 6.5 && value <= 12.5;
}

function validMlbSpreadLine(value: number) {
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
      validMlbSpreadLine(homeSpread.point) &&
      positiveNumber(awaySpread.price) &&
      positiveNumber(homeSpread.price);

    const totals = market(bookmaker, "totals");
    const over = totalOutcome(totals, "Over");
    const under = totalOutcome(totals, "Under");
    const totalValid =
      finiteNumber(over?.point) &&
      finiteNumber(under?.point) &&
      over.point === under.point &&
      validMlbTotalLine(over.point) &&
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
    regions: "us",
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

    // 2차: 경기가 이미 시작되면 날짜 필터 조회에서 빠질 수 있으므로
    // 현재 라이브/예정 전체 목록을 다시 조회해 정확한 경기 또는 시작시간을 찾습니다.
    if (!event) {
      const liveAndUpcomingEvents = await requestEvents(baseParams);
      const fallbackResult = findEvent(liveAndUpcomingEvents);
      event = fallbackResult.event;
      matchMode = fallbackResult.matchMode;
    }

    if (!event) {
      return NextResponse.json<MarketResponse>({
        success: false,
        status: "unavailable",
        message: `${date} ${requestedAway} vs ${requestedHome} 경기의 현재 배당 제공이 종료되었거나 등록되지 않았습니다.`,
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

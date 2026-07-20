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

function selectBookmaker(event: ApiEvent, awayApi: string, homeApi: string) {
  const priority = ["fanduel", "draftkings", "betmgm", "williamhill_us", "bovada"];
  const usable = (event.bookmakers ?? []).filter((bookmaker) => {
    const h2h = market(bookmaker, "h2h");
    return positiveNumber(outcome(h2h, awayApi)?.price) && positiveNumber(outcome(h2h, homeApi)?.price);
  });

  usable.sort((a, b) => {
    const ai = priority.indexOf(a.key ?? "");
    const bi = priority.indexOf(b.key ?? "");
    const ar = ai === -1 ? 999 : ai;
    const br = bi === -1 ? 999 : bi;
    return ar - br;
  });

  return { selected: usable[0], usable };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date")?.trim() ?? "";
  const requestedAway = searchParams.get("away")?.trim() ?? "";
  const requestedHome = searchParams.get("home")?.trim() ?? "";

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

  const params = new URLSearchParams({
    apiKey,
    regions: "us",
    markets: "h2h,spreads,totals",
    oddsFormat: "decimal",
    dateFormat: "iso",
    commenceTimeFrom: range.start,
    commenceTimeTo: range.end,
  });

  try {
    const response = await fetch(
      `https://api.the-odds-api.com/v4/sports/baseball_kbo/odds?${params.toString()}`,
      { cache: "no-store" },
    );

    const remaining = response.headers.get("x-requests-remaining");
    const used = response.headers.get("x-requests-used");

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return NextResponse.json<MarketResponse>(
        {
          success: false,
          status: "error",
          message: `The Odds API 오류 (${response.status})${detail ? `: ${detail}` : ""}`,
          remaining,
          used,
          market: null,
        },
        { status: 502 },
      );
    }

    const events = (await response.json()) as ApiEvent[];
    const away = canonicalTeam(requestedAway);
    const home = canonicalTeam(requestedHome);

    const event = events.find(
      (item) =>
        canonicalTeam(item.away_team ?? "") === away &&
        canonicalTeam(item.home_team ?? "") === home,
    );

    if (!event) {
      return NextResponse.json<MarketResponse>({
        success: false,
        status: "unavailable",
        message: `${date} ${requestedAway} vs ${requestedHome} 경기 배당이 아직 등록되지 않았습니다.`,
        remaining,
        used,
        market: null,
      });
    }

    const awayApi = event.away_team ?? requestedAway;
    const homeApi = event.home_team ?? requestedHome;
    const { selected, usable } = selectBookmaker(event, awayApi, homeApi);

    if (!selected) {
      return NextResponse.json<MarketResponse>({
        success: false,
        status: "unavailable",
        message: "경기는 찾았지만 승패 배당이 아직 없습니다.",
        remaining,
        used,
        market: null,
      });
    }

    const h2h = market(selected, "h2h");
    const spreads = market(selected, "spreads");
    const totals = market(selected, "totals");

    const awayMoney = outcome(h2h, awayApi)?.price;
    const homeMoney = outcome(h2h, homeApi)?.price;

    const awaySpread = outcome(spreads, awayApi);
    const homeSpread = outcome(spreads, homeApi);
    const over = totalOutcome(totals, "Over");
    const under = totalOutcome(totals, "Under");

    const moneyline = positiveNumber(awayMoney) && positiveNumber(homeMoney)
      ? { away: awayMoney, home: homeMoney }
      : null;

    // 기존 화면은 홈팀 기준 핸디 라인을 사용합니다.
    const handicap =
      finiteNumber(homeSpread?.point) &&
      positiveNumber(awaySpread?.price) &&
      positiveNumber(homeSpread?.price)
        ? {
            line: homeSpread.point,
            away: awaySpread.price,
            home: homeSpread.price,
          }
        : null;

    const total =
      finiteNumber(over?.point) && positiveNumber(over.price) && positiveNumber(under?.price)
        ? { line: over.point, under: under.price, over: over.price }
        : null;

    const lastUpdate = [selected.last_update, h2h?.last_update, spreads?.last_update, totals?.last_update]
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1);

    return NextResponse.json<MarketResponse>({
      success: true,
      status: "received",
      bookmaker: selected.title ?? selected.key ?? "Sportsbook",
      bookmakerCount: usable.length,
      lastUpdate,
      remaining,
      used,
      market: {
        moneyline,
        handicap,
        total,
        history: { moneyline: [], handicap: [], total: [] },
      },
    });
  } catch (error) {
    return NextResponse.json<MarketResponse>(
      {
        success: false,
        status: "error",
        message: error instanceof Error ? error.message : "배당 수신에 실패했습니다.",
        market: null,
      },
      { status: 500 },
    );
  }
}

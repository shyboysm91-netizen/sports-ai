import { NextResponse } from "next/server";

type ApiOutcome = { name?: string; price?: number; point?: number };
type ApiMarket = { key?: string; last_update?: string; outcomes?: ApiOutcome[] };
type ApiBookmaker = { key?: string; title?: string; last_update?: string; markets?: ApiMarket[] };
type ApiEvent = { id?: string; commence_time?: string; home_team?: string; away_team?: string; bookmakers?: ApiBookmaker[] };

type MarketResponse = {
  success: boolean;
  status: "received" | "unavailable" | "error";
  message?: string;
  bookmaker?: string;
  bookmakerCount?: number;
  lastUpdate?: string;
  remaining?: string | null;
  used?: string | null;
  cached?: boolean;
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

type CacheRow = { payload: MarketResponse; expires_at: string };

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
  return marketValue?.outcomes?.find((item) => (item.name ?? "").toLowerCase() === name.toLowerCase());
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
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
  return { selected: usable[0], usable };
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return { url: url.replace(/\/$/, ""), key };
}
function cacheKey(date: string, away: string, home: string) {
  return `/api/betman?date=${encodeURIComponent(date)}&away=${encodeURIComponent(canonicalTeam(away))}&home=${encodeURIComponent(canonicalTeam(home))}`;
}
async function readCache(keyValue: string): Promise<CacheRow | null> {
  const { url, key } = supabaseConfig();
  if (!url || !key) return null;
  const response = await fetch(`${url}/rest/v1/sports_cache?cache_key=eq.${encodeURIComponent(keyValue)}&select=payload,expires_at&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const rows = (await response.json()) as CacheRow[];
  return rows[0] ?? null;
}
async function writeCache(keyValue: string, payload: MarketResponse, ttlSeconds: number) {
  const { url, key } = supabaseConfig();
  if (!url || !key) return;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  await fetch(`${url}/rest/v1/sports_cache?on_conflict=cache_key`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({ cache_key: keyValue, payload, expires_at: expiresAt, updated_at: new Date().toISOString() }),
    cache: "no-store",
  }).catch(() => undefined);
}
function isAuthorizedRefresh(req: Request, searchParams: URLSearchParams) {
  if (searchParams.get("refresh") !== "1") return false;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date")?.trim() ?? "";
  const requestedAway = searchParams.get("away")?.trim() ?? "";
  const requestedHome = searchParams.get("home")?.trim() ?? "";
  if (!date || !requestedAway || !requestedHome) {
    return NextResponse.json<MarketResponse>({ success: false, status: "error", message: "date, away, home 값이 필요합니다.", market: null }, { status: 400 });
  }

  const keyValue = cacheKey(date, requestedAway, requestedHome);
  const refresh = isAuthorizedRefresh(req, searchParams);
  const cached = await readCache(keyValue);
  const cacheFresh = cached ? new Date(cached.expires_at).getTime() > Date.now() : false;

  // 일반 방문자는 저장 데이터가 있으면 만료 여부와 관계없이 DB만 사용합니다.
  if (cached && (!refresh || cacheFresh)) {
    return NextResponse.json({ ...cached.payload, cached: true });
  }

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    if (cached) return NextResponse.json({ ...cached.payload, cached: true });
    return NextResponse.json<MarketResponse>({ success: false, status: "error", message: ".env.local에 ODDS_API_KEY가 없습니다.", market: null }, { status: 500 });
  }
  const range = kstDayRangeIso(date);
  if (!range) {
    return NextResponse.json<MarketResponse>({ success: false, status: "error", message: "날짜 형식은 YYYY-MM-DD여야 합니다.", market: null }, { status: 400 });
  }

  const params = new URLSearchParams({ apiKey, regions: "us", markets: "h2h,spreads,totals", oddsFormat: "decimal", dateFormat: "iso", commenceTimeFrom: range.start, commenceTimeTo: range.end });

  try {
    const response = await fetch(`https://api.the-odds-api.com/v4/sports/baseball_kbo/odds?${params.toString()}`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    const remaining = response.headers.get("x-requests-remaining");
    const used = response.headers.get("x-requests-used");

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      if (cached) return NextResponse.json({ ...cached.payload, cached: true });
      const quotaExceeded = response.status === 401 && detail.includes("OUT_OF_USAGE_CREDITS");
      const payload: MarketResponse = {
        success: false,
        status: "error",
        message: quotaExceeded
          ? "배당 API 무료 사용량이 소진되었습니다. 사용량이 복구되면 자동 갱신됩니다."
          : `The Odds API 오류 (${response.status})${detail ? `: ${detail}` : ""}`,
        remaining,
        used,
        market: null,
      };
      // 사용량 소진은 6시간, 기타 오류는 10분 저장해 방문자 반복 호출을 차단합니다.
      await writeCache(keyValue, payload, quotaExceeded ? 21600 : 600);
      return NextResponse.json(payload, { status: 200 });
    }

    const events = (await response.json()) as ApiEvent[];
    const away = canonicalTeam(requestedAway);
    const home = canonicalTeam(requestedHome);
    const event = events.find((item) => canonicalTeam(item.away_team ?? "") === away && canonicalTeam(item.home_team ?? "") === home);

    if (!event) {
      const payload: MarketResponse = { success: false, status: "unavailable", message: `${date} ${requestedAway} vs ${requestedHome} 경기 배당이 아직 등록되지 않았습니다.`, remaining, used, market: null };
      await writeCache(keyValue, payload, 1800);
      return NextResponse.json(payload);
    }

    const awayApi = event.away_team ?? requestedAway;
    const homeApi = event.home_team ?? requestedHome;
    const { selected, usable } = selectBookmaker(event, awayApi, homeApi);
    if (!selected) {
      const payload: MarketResponse = { success: false, status: "unavailable", message: "경기는 찾았지만 승패 배당이 아직 없습니다.", remaining, used, market: null };
      await writeCache(keyValue, payload, 1800);
      return NextResponse.json(payload);
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
    const moneyline = positiveNumber(awayMoney) && positiveNumber(homeMoney) ? { away: awayMoney, home: homeMoney } : null;
    const handicap = finiteNumber(homeSpread?.point) && positiveNumber(awaySpread?.price) && positiveNumber(homeSpread?.price) ? { line: homeSpread.point, away: awaySpread.price, home: homeSpread.price } : null;
    const total = finiteNumber(over?.point) && positiveNumber(over.price) && positiveNumber(under?.price) ? { line: over.point, under: under.price, over: over.price } : null;
    const lastUpdate = [selected.last_update, h2h?.last_update, spreads?.last_update, totals?.last_update].filter((value): value is string => Boolean(value)).sort().at(-1);

    const payload: MarketResponse = {
      success: true,
      status: "received",
      bookmaker: selected.title ?? selected.key ?? "Sportsbook",
      bookmakerCount: usable.length,
      lastUpdate,
      remaining,
      used,
      market: { moneyline, handicap, total, history: { moneyline: [], handicap: [], total: [] } },
    };
    await writeCache(keyValue, payload, 1800);
    return NextResponse.json(payload);
  } catch (error) {
    if (cached) return NextResponse.json({ ...cached.payload, cached: true });
    const payload: MarketResponse = { success: false, status: "error", message: error instanceof Error ? error.message : "배당 수신에 실패했습니다.", market: null };
    await writeCache(keyValue, payload, 600);
    return NextResponse.json(payload, { status: 200 });
  }
}

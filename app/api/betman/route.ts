import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ScheduleRow = Record<string, unknown>;

type OddsPoint = {
  at: string;
  away?: number;
  home?: number;
  draw?: number;
  under?: number;
  over?: number;
  line?: number;
};

type BetmanMarket = {
  matchSeq: number;
  away: string;
  home: string;
  moneyline: { away: number; home: number; draw?: number } | null;
  handicap: { line: number; away: number; home: number; draw?: number } | null;
  total: { line: number; under: number; over: number } | null;
  history: {
    moneyline: OddsPoint[];
    handicap: OddsPoint[];
    total: OddsPoint[];
  };
};

const TEAM_ALIASES: Record<string, string[]> = {
  "KIA 타이거즈": ["KIA 타이거즈", "KIA", "기아 타이거즈", "기아"],
  "SSG 랜더스": ["SSG 랜더스", "SSG"],
  "LG 트윈스": ["LG 트윈스", "LG"],
  "KT 위즈": ["KT 위즈", "KT", "kt wiz"],
  "삼성 라이온즈": ["삼성 라이온즈", "삼성"],
  "두산 베어스": ["두산 베어스", "두산"],
  "롯데 자이언츠": ["롯데 자이언츠", "롯데"],
  "NC 다이노스": ["NC 다이노스", "NC"],
  "한화 이글스": ["한화 이글스", "한화"],
  "키움 히어로즈": ["키움 히어로즈", "키움"],
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
}

function teamMatches(source: string, target: string) {
  const normalized = normalize(source);
  return [target, ...(TEAM_ALIASES[target] ?? [])].some((name) => normalize(name) === normalized);
}

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function openBetmanSession(referer: string) {
  const response = await fetch(referer, {
    method: "GET",
    cache: "no-store",
    redirect: "follow",
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36",
    },
  });

  // Node fetch merges multiple Set-Cookie headers. Betman only needs the cookie
  // name/value pairs, so strip attributes before forwarding them.
  const setCookie = response.headers.get("set-cookie") ?? "";
  return setCookie
    .split(/,(?=[^;,]+=)/g)
    .map((cookie) => cookie.trim().split(";", 1)[0])
    .filter(Boolean)
    .join("; ");
}

async function postJson(url: string, body: unknown, referer: string) {
  const cookie = await openBetmanSession(referer);
  const response = await fetch(url, {
    method: "POST",
    cache: "no-store",
    redirect: "manual",
    headers: {
      accept: "application/json, text/javascript, */*; q=0.01",
      "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      "content-type": "application/json; charset=UTF-8",
      origin: "https://www.betman.co.kr",
      referer,
      ...(cookie ? { cookie } : {}),
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36",
      "x-requested-with": "XMLHttpRequest",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) throw new Error(`Betman HTTP ${response.status}`);

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("json") || text.trim().startsWith("<")) {
    throw new Error("베트맨이 JSON 대신 접속 차단 페이지를 반환했습니다. 잠시 후 다시 시도해 주세요.");
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("베트맨 배당 응답 형식을 읽지 못했습니다.");
  }
}

async function discoverRound() {
  const envRound = Number(process.env.BETMAN_GM_TS || 0);
  if (envRound > 0) return envRound;

  const slipUrl = "https://www.betman.co.kr/main/mainPage/gamebuy/gameSlip.do?frameType=typeA&gmId=G101";
  try {
    const response = await fetch(slipUrl, {
      cache: "no-store",
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0", accept: "text/html,*/*" },
    });
    const text = await response.text();
    const candidates = Array.from(text.matchAll(/(?:gmTs(?:=|%3D|\"\s*:\s*)|GM_TS\"?\s*:\s*)(\d{6})/gi))
      .map((match) => Number(match[1])).filter(Number.isFinite);
    if (candidates.length) return Math.max(...candidates);
  } catch {}

  // 2026-07-16 현재 판매 회차. 페이지 자동 탐색 실패 시에만 사용한다.
  return 260083;
}

function rowsFromResponse(payload: any): ScheduleRow[] {
  const keys = payload?.compSchedules?.keys;
  const datas = payload?.compSchedules?.datas;
  if (!Array.isArray(keys) || !Array.isArray(datas)) return [];
  return datas.map((row: unknown[]) => Object.fromEntries(keys.map((key: string, index: number) => [key, row[index]])));
}

function buildMarket(rows: ScheduleRow[], away: string, home: string, tooltipList: any[] = []): BetmanMarket | null {
  const matched = rows.filter((row) =>
    String(row.leagueName ?? row.leagueShortName ?? "").toUpperCase() === "KBO" &&
    teamMatches(String(row.awayName ?? ""), away) && teamMatches(String(row.homeName ?? ""), home)
  );
  if (!matched.length) return null;

  const normal = matched.find((row) => String(row.betNm ?? "").includes("야구 승패") || String(row.betTypId ?? "") === "2");
  const handicapRow = matched.find((row) => String(row.betNm ?? "").includes("야구 핸디캡"));
  const totalRow = matched.find((row) => String(row.betNm ?? "").includes("야구 언더오버"));

  // 베트맨의 야구 승패 표시는 화면상 "승=홈팀", "패=원정팀" 기준이다.
  // 따라서 winAllot은 홈팀, loseAllot은 원정팀 배당으로 매핑해야 한다.
  const moneyline = normal ? {
    away: toNumber(normal.loseAllot),
    home: toNumber(normal.winAllot),
    ...(toNumber(normal.drawAllot) > 1 ? { draw: toNumber(normal.drawAllot) } : {}),
  } : null;

  const handicap = handicapRow ? {
    line: toNumber(handicapRow.winHandi || handicapRow.handi),
    away: toNumber(handicapRow.winAllot),
    home: toNumber(handicapRow.loseAllot),
    ...(toNumber(handicapRow.drawAllot) > 1 ? { draw: toNumber(handicapRow.drawAllot) } : {}),
  } : null;

  const total = totalRow ? {
    line: Math.abs(toNumber(totalRow.winHandi || totalRow.loseHandi || totalRow.handi)),
    under: toNumber(totalRow.winAllot),
    over: toNumber(totalRow.loseAllot),
  } : null;

  function historyFor(row: ScheduleRow | undefined, kind: "moneyline" | "handicap" | "total") {
    if (!row) return [] as OddsPoint[];
    const seq = toNumber(row.matchSeq);
    return tooltipList
      .filter((item) => toNumber(item.GM_SEQ) === seq)
      .sort((a, b) => String(a.CHG_DTM).localeCompare(String(b.CHG_DTM)))
      .map((item): OddsPoint => {
        const at = String(item.CHG_DTM ?? item.LST_CHG_DTM ?? "");
        if (kind === "total") {
          return {
            at,
            under: toNumber(item.ACHG_W_ODDS) / 100,
            over: toNumber(item.ACHG_L_ODDS) / 100,
            line: Math.abs(toNumber(item.ACHG_W_HANDI_RT || item.ACHG_L_HANDI_RT)),
          };
        }
        return {
          at,
          away: toNumber(item.ACHG_L_ODDS) / 100,
          home: toNumber(item.ACHG_W_ODDS) / 100,
          ...(toNumber(item.ACHG_D_ODDS) > 0 ? { draw: toNumber(item.ACHG_D_ODDS) / 100 } : {}),
          ...(kind === "handicap" ? { line: toNumber(item.ACHG_W_HANDI_RT || item.ACHG_L_HANDI_RT) } : {}),
        };
      })
      .filter((point) => kind === "total" ? (point.under ?? 0) > 1 && (point.over ?? 0) > 1 : (point.away ?? 0) > 1 && (point.home ?? 0) > 1);
  }

  return {
    matchSeq: toNumber((normal ?? totalRow ?? handicapRow)?.matchSeq),
    away: String(matched[0].awayName),
    home: String(matched[0].homeName),
    moneyline: moneyline && moneyline.away > 1 && moneyline.home > 1 ? moneyline : null,
    handicap: handicap && handicap.away > 1 && handicap.home > 1 ? handicap : null,
    total: total && total.line > 0 && total.under > 1 && total.over > 1 ? total : null,
    history: {
      moneyline: historyFor(normal, "moneyline"),
      handicap: historyFor(handicapRow, "handicap"),
      total: historyFor(totalRow, "total"),
    },
  };
}

export async function GET(request: NextRequest) {
  const away = request.nextUrl.searchParams.get("away") ?? "";
  const home = request.nextUrl.searchParams.get("home") ?? "";
  const requestedRound = Number(request.nextUrl.searchParams.get("gmTs") || 0);
  if (!away || !home) return NextResponse.json({ success: false, message: "원정팀과 홈팀이 필요합니다." }, { status: 400 });

  try {
    const gmTs = requestedRound || await discoverRound();
    const referer = `https://www.betman.co.kr/main/mainPage/gamebuy/gameSlip.do?frameType=typeA&gmId=G101&gmTs=${gmTs}`;
    const payload = await postJson("https://www.betman.co.kr/buyPsblGame/gameInfoInq.do", {
      gmId: "G101",
      gmTs,
      gameYear: "",
      _sbmInfo: { _sbmInfo: { debugMode: "false" } },
    }, referer);

    const rows = rowsFromResponse(payload);
    const market = buildMarket(rows, away, home, Array.isArray(payload?.tooltipList) ? payload.tooltipList : []);
    return NextResponse.json({
      success: true,
      status: market ? "received" : "unavailable",
      provider: "BETMAN",
      gmTs: payload?.gmTs ?? gmTs,
      market,
      fetchedAt: new Date().toISOString(),
      message: market ? "베트맨 배당 자동 수신 완료" : "현재 회차에서 해당 KBO 경기 배당을 찾지 못했습니다.",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      status: "error",
      provider: "BETMAN",
      market: null,
      message: error instanceof Error ? error.message : "베트맨 배당 수신 실패",
    }, { status: 502 });
  }
}

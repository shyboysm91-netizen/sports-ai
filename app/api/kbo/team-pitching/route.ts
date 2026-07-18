import { NextResponse } from "next/server";

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

const TEAM_NAMES: Record<string, string> = {
  KIA: "KIA 타이거즈",
  SAMSUNG: "삼성 라이온즈",
  LG: "LG 트윈스",
  DOOSAN: "두산 베어스",
  KT: "KT 위즈",
  SSG: "SSG 랜더스",
  LOTTE: "롯데 자이언츠",
  HANWHA: "한화 이글스",
  NC: "NC 다이노스",
  KIWOOM: "키움 히어로즈",
};

// KBO 공식 기록 사이트 내부 팀 코드
const KBO_TEAM_IDS: Record<string, string> = {
  KIA: "HT",
  SAMSUNG: "SS",
  LG: "LG",
  DOOSAN: "OB",
  KT: "KT",
  SSG: "SK",
  LOTTE: "LT",
  HANWHA: "HH",
  NC: "NC",
  KIWOOM: "WO",
};

function cleanHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value: string | undefined) {
  if (!value || value === "-") return 0;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseInnings(value: string | undefined) {
  if (!value) return 0;
  const cleaned = value.trim();
  const mixed = cleaned.match(/^(\d+)\s+(1\/3|2\/3)$/);
  if (mixed) return Number(mixed[1]) + (mixed[2] === "1/3" ? 1 / 3 : 2 / 3);
  if (cleaned === "1/3") return 1 / 3;
  if (cleaned === "2/3") return 2 / 3;
  return Number(cleaned) || 0;
}

function getCells(row: string) {
  return (row.match(/<td\b[^>]*>[\s\S]*?<\/td>/gi) ?? []).map((html) => ({
    html,
    text: cleanHtml(html),
  }));
}

function getPcode(html: string) {
  return html.match(/[?&](?:playerId|pcode)=(\d+)/i)?.[1] ?? "";
}

function normalizeName(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
}

async function fetchPitcherPage(teamId: string) {
  const urls = [
    `https://www.koreabaseball.com/Record/Player/PitcherBasic/Basic1.aspx?teamId=${teamId}&pos=PO`,
    `https://www.koreabaseball.com/Record/Player/PitcherBasic/Basic1.aspx?teamId=${teamId}`,
  ];

  let best = "";
  for (const url of urls) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/html,application/xhtml+xml",
        Referer: "https://www.koreabaseball.com/Record/Player/PitcherBasic/Basic1.aspx",
      },
      cache: "no-store",
    });
    if (!response.ok) continue;
    const html = await response.text();
    if (html.length > best.length) best = html;
    if (/playerId=\d+/i.test(html)) return html;
  }
  return best;
}

function parsePitchers(html: string, teamCode: string): TeamPitcher[] {
  const rows = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  const pitchers: TeamPitcher[] = [];
  const seen = new Set<string>();
  const expectedTeam = TEAM_NAMES[teamCode];

  for (const row of rows) {
    const cells = getCells(row);
    if (cells.length < 10) continue;

    const playerIndex = cells.findIndex((cell) => /[?&](?:playerId|pcode)=\d+/i.test(cell.html));
    if (playerIndex < 0) continue;

    const pcode = getPcode(cells[playerIndex].html);
    const player = cells[playerIndex].text;
    if (!pcode || !player || seen.has(pcode)) continue;

    // KBO Basic1 표: 순위, 선수명, 팀명, ERA, G, W, L, SV, HLD, WPCT, IP, H, HR, BB, HBP, SO, R, ER, WHIP
    const teamText = cells[playerIndex + 1]?.text ?? "";
    const eraIndex = playerIndex + 2;
    if (teamText && !normalizeName(expectedTeam).includes(normalizeName(teamText)) &&
        !normalizeName(teamText).includes(normalizeName(expectedTeam).slice(0, 2))) {
      continue;
    }

    const era = parseNumber(cells[eraIndex]?.text);
    const games = parseNumber(cells[eraIndex + 1]?.text);
    const wins = parseNumber(cells[eraIndex + 2]?.text);
    const losses = parseNumber(cells[eraIndex + 3]?.text);
    const saves = parseNumber(cells[eraIndex + 4]?.text);
    const holds = parseNumber(cells[eraIndex + 5]?.text);
    const winningPercentage = parseNumber(cells[eraIndex + 6]?.text);
    const innings = cells[eraIndex + 7]?.text ?? "-";
    const hits = parseNumber(cells[eraIndex + 8]?.text);
    const homeRuns = parseNumber(cells[eraIndex + 9]?.text);
    const walks = parseNumber(cells[eraIndex + 10]?.text);
    const hitByPitch = parseNumber(cells[eraIndex + 11]?.text);
    const strikeouts = parseNumber(cells[eraIndex + 12]?.text);
    const runs = parseNumber(cells[eraIndex + 13]?.text);
    const earnedRuns = parseNumber(cells[eraIndex + 14]?.text);
    const whip = parseNumber(cells[eraIndex + 15]?.text);

    if (!games && !parseInnings(innings) && era === 0) continue;

    seen.add(pcode);
    pitchers.push({
      pcode,
      player,
      teamCode,
      team: expectedTeam,
      era,
      games,
      completeGames: 0,
      shutouts: 0,
      wins,
      losses,
      saves,
      holds,
      winningPercentage,
      plateAppearances: 0,
      pitches: 0,
      innings,
      inningsValue: parseInnings(innings),
      hits,
      doubles: 0,
      triples: 0,
      homeRuns,
      walks,
      hitByPitch,
      strikeouts,
      runs,
      earnedRuns,
      whip,
    });
  }

  return pitchers.sort((a, b) => b.inningsValue - a.inningsValue || a.era - b.era);
}

async function loadTeamPitchers(teamCode: string) {
  const teamId = KBO_TEAM_IDS[teamCode];
  const html = await fetchPitcherPage(teamId);
  if (!html) throw new Error(`${TEAM_NAMES[teamCode]} 투수 기록 페이지를 받지 못했습니다.`);
  return parsePitchers(html, teamCode);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTeam = searchParams.get("team")?.toUpperCase() ?? "";
    const teamCodes = requestedTeam ? [requestedTeam] : Object.keys(TEAM_NAMES);

    for (const teamCode of teamCodes) {
      if (!TEAM_NAMES[teamCode]) {
        return NextResponse.json({ success: false, message: `지원하지 않는 팀 코드입니다: ${teamCode}`, pitchers: [] }, { status: 400 });
      }
    }

    const teamResults = await Promise.all(teamCodes.map(async (teamCode) => ({
      teamCode,
      team: TEAM_NAMES[teamCode],
      pitchers: await loadTeamPitchers(teamCode),
    })));
    const pitchers = teamResults.flatMap((result) => result.pitchers);

    return NextResponse.json({
      success: true,
      source: "KBO official Korean pitcher stats",
      updatedAt: new Date().toISOString(),
      teamCount: teamResults.length,
      pitcherCount: pitchers.length,
      teams: teamResults,
      pitchers,
    });
  } catch (error) {
    console.error("KBO 투수 기록 오류:", error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "KBO 투수 기록을 불러오지 못했습니다.",
      pitchers: [],
    }, { status: 500 });
  }
}

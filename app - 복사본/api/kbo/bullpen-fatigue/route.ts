import { NextResponse } from "next/server";

type BullpenLine = {
  name: string;
  innings: string;
  pitches: number;
  battersFaced: number;
  date: string;
  consecutiveDays: number;
};

const BASE = "https://mykbostats.com";
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
};

const TEAM_SCHEDULE: Record<string, string> = {
  DOOSAN: "1-Doosan-Bears",
  HANWHA: "4-Hanwha-Eagles",
  KIA: "5-Kia-Tigers",
  KIWOOM: "23-Kiwoom-Heroes",
  KT: "22-KT-Wiz",
  LG: "6-LG-Twins",
  LOTTE: "2-Lotte-Giants",
  NC: "9-NC-Dinos",
  SAMSUNG: "3-Samsung-Lions",
  SSG: "24-SSG-Landers",
};

const URL_TEAM: Record<string, string> = {
  DOOSAN: "Doosan",
  HANWHA: "Hanwha",
  KIA: "Kia",
  KIWOOM: "Kiwoom",
  KT: "KT",
  LG: "LG",
  LOTTE: "Lotte",
  NC: "NC",
  SAMSUNG: "Samsung",
  SSG: "SSG",
};

const ALIASES: Record<string, string[]> = {
  KIA: ["KIA", "기아", "타이거즈"],
  SAMSUNG: ["삼성", "라이온즈"],
  LG: ["LG", "엘지", "트윈스"],
  DOOSAN: ["두산", "베어스", "OB"],
  KT: ["KT", "위즈"],
  SSG: ["SSG", "SK", "랜더스"],
  LOTTE: ["롯데", "자이언츠"],
  HANWHA: ["한화", "이글스"],
  NC: ["NC", "엔씨", "다이노스"],
  KIWOOM: ["키움", "히어로즈"],
};

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&frac13;|⅓/gi, " 1/3")
    .replace(/&frac23;|⅔/gi, " 2/3");
}

function cleanHtml(value: string) {
  return decodeHtml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getCells(row: string) {
  return (row.match(/<t[dh]\b[^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []).map(
    cleanHtml,
  );
}

function numberValue(value: string | undefined) {
  const parsed = Number(
    (value ?? "").replace(/,/g, "").replace(/[^0-9.-]/g, ""),
  );
  return Number.isFinite(parsed) ? parsed : 0;
}

function inningsValue(value: string) {
  const text = value.trim();
  const mixed = text.match(/^(\d+)\s+(1\/3|2\/3)$/);
  if (mixed) {
    return Number(mixed[1]) + (mixed[2] === "1/3" ? 1 / 3 : 2 / 3);
  }
  if (text === "1/3") return 1 / 3;
  if (text === "2/3") return 2 / 3;
  return numberValue(text);
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
}

function resolveTeamCode(value: string) {
  const normalized = normalize(value);
  for (const [code, aliases] of Object.entries(ALIASES)) {
    if (aliases.some((alias) => normalized.includes(normalize(alias)))) {
      return code;
    }
  }
  return "";
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: HEADERS,
    next: { revalidate: 600 },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`MyKBO 응답 오류 ${response.status}`);
  return response.text();
}

const fetchHtml = fetchText;

function formatKstDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function previousDates(target: string, count = 8) {
  const base = new Date(`${target}T12:00:00+09:00`);
  const dates: string[] = [];
  for (let offset = 1; offset <= count; offset += 1) {
    const date = new Date(base);
    date.setDate(date.getDate() - offset);
    dates.push(formatKstDate(date));
  }
  return dates;
}

function weekStart(dateText: string) {
  const date = new Date(`${dateText}T12:00:00+09:00`);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + mondayOffset);
  return formatKstDate(date);
}

function extractGameLinks(text: string, code: string, allowedDates: Set<string>) {
  const teamToken = URL_TEAM[code];
  const output: string[] = [];
  const decoded = decodeHtml(text).replace(/\\n/g, "\n");

  // HTML, LiveView payload, ICS의 URL 필드를 모두 처리합니다.
  const patterns = [
    /(?:https?:\/\/mykbostats\.com)?(\/games\/\d+-[A-Za-z]+-vs-[A-Za-z]+-\d{8})/gi,
    /URL[^:]*:(?:https?:\/\/mykbostats\.com)?(\/games\/\d+-[A-Za-z]+-vs-[A-Za-z]+-\d{8})/gi,
  ];

  for (const pattern of patterns) {
    for (const match of decoded.matchAll(pattern)) {
      const href = match[1];
      const rawDate = href.match(/(\d{8})$/)?.[1];
      if (!rawDate) continue;
      const date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
      if (!allowedDates.has(date)) continue;

      const slug = href.split("/").pop() ?? "";
      if (!new RegExp(`(?:^|-)${teamToken}(?:-vs-|-|$)`, "i").test(slug)) continue;
      output.push(href);
    }
  }

  return [...new Set(output)];
}

function gameTeamOrder(href: string) {
  const match = href.match(/\/games\/\d+-([A-Za-z]+)-vs-([A-Za-z]+)-\d{8}$/i);
  if (!match) return [];
  return [match[1], match[2]];
}

function pitchingTables(html: string) {
  const pitchingStart = html.search(/>\s*Pitching\s*</i);
  const source = pitchingStart >= 0 ? html.slice(pitchingStart) : html;
  return (source.match(/<table\b[^>]*>[\s\S]*?<\/table>/gi) ?? []).filter(
    (table) => {
      const text = cleanHtml(table);
      return /\bERA\b/i.test(text) && /\bIP\b/i.test(text) && /\bNP\b/i.test(text);
    },
  );
}

function parsePitchingTable(table: string, date: string) {
  const rows = table.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  const parsed: Array<Omit<BullpenLine, "consecutiveDays">> = [];

  let header: string[] = [];
  for (const row of rows) {
    const rowCells = getCells(row);
    if (!rowCells.length) continue;

    const joined = rowCells.join(" ");
    if (/\bERA\b/i.test(joined) && /\bIP\b/i.test(joined)) {
      header = rowCells.map((cell) => cell.toUpperCase());
      continue;
    }

    const playerLink = row.match(
      /href=["']\/players\/\d+-[^"']+["'][^>]*>([\s\S]*?)<\/a>/i,
    );
    if (!playerLink) continue;

    const name = cleanHtml(playerLink[1]);
    const playerIndex = rowCells.findIndex(
      (cell) => normalize(cell) === normalize(name),
    );
    const stats = playerIndex >= 0 ? rowCells.slice(playerIndex + 1) : rowCells.slice(1);

    const ipIndex = header.findIndex((value) => value === "IP") - 1;
    const npIndex = header.findIndex((value) => value === "NP") - 1;
    const innings = stats[ipIndex >= 0 ? ipIndex : 1] ?? "0";
    const pitches = numberValue(stats[npIndex >= 0 ? npIndex : 2]);

    parsed.push({
      name,
      innings,
      pitches,
      battersFaced: 0,
      date,
    });
  }

  // 첫 번째 투수는 선발이므로 불펜 목록에서 제외합니다.
  return parsed.slice(1);
}

function parseGame(html: string, href: string, code: string, date: string) {
  const tables = pitchingTables(html);
  if (!tables.length) return [];

  const teams = gameTeamOrder(href);
  const targetToken = URL_TEAM[code]?.toLowerCase();
  const tableIndex = teams.findIndex(
    (team) => team.toLowerCase() === targetToken,
  );

  const selectedTable = tables[tableIndex >= 0 ? tableIndex : 0];
  if (!selectedTable) return [];

  return parsePitchingTable(selectedTable, date).map((line) => ({
    ...line,
    consecutiveDays: 1,
  }));
}

function calculateFatigue(latest: BullpenLine[], all: BullpenLine[]) {
  const yesterdayPitches = latest.reduce((sum, row) => sum + row.pitches, 0);
  const recent3DayPitches = all.reduce((sum, row) => sum + row.pitches, 0);

  const pitcherDates = new Map<string, Set<string>>();
  for (const row of all) {
    if (!pitcherDates.has(row.name)) pitcherDates.set(row.name, new Set());
    pitcherDates.get(row.name)?.add(row.date);
  }

  const consecutivePitchers = [...pitcherDates.values()].filter(
    (dates) => dates.size >= 2,
  ).length;
  const heavyPitchers = latest.filter(
    (row) => row.pitches >= 25 || inningsValue(row.innings) >= 2,
  ).length;

  const score = Math.min(
    100,
    Math.round(
      yesterdayPitches * 0.7 +
        (recent3DayPitches - yesterdayPitches) * 0.25 +
        consecutivePitchers * 15 +
        heavyPitchers * 12 +
        (latest.length >= 4 ? 8 : 0),
    ),
  );

  return {
    score,
    label:
      score >= 80
        ? "매우 높음"
        : score >= 55
          ? "높음"
          : score >= 30
            ? "보통"
            : "낮음",
    yesterdayPitches,
    recent3DayPitches,
    yesterdayBattersFaced: 0,
    recent3DayBattersFaced: 0,
    pitcherCount: latest.length,
    heavyPitchers,
    consecutivePitchers,
    workloadUnit: "NP",
  };
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const code = resolveTeamCode(params.get("team") ?? "");
    const targetDate = params.get("date") || formatKstDate(new Date());

    if (!code) {
      return NextResponse.json(
        {
          success: false,
          status: "error",
          pitchers: [],
          fatigue: null,
          message: "올바른 팀명이 필요합니다.",
        },
        { status: 400 },
      );
    }

    const dates = previousDates(targetDate, 8);
    const allowed = new Set(dates);
    const scheduleSlug = TEAM_SCHEDULE[code];
    const weeks = [...new Set(dates.map(weekStart))];

    const scheduleUrls = weeks.map(
      (week) => `${BASE}/schedule/${scheduleSlug}/week_of/${week}`,
    );
    scheduleUrls.push(`${BASE}/schedule/${scheduleSlug}`);
    scheduleUrls.push(`${BASE}/teams/${scheduleSlug}`);

    // MyKBO 일정 페이지는 일부 요청에서 LiveView 초기 HTML만 내려와 경기 링크가 비어 있습니다.
    // 팀 iCalendar 피드는 서버에서 완성된 경기 URL을 내려주므로 함께 사용합니다.
    const feedUrl = `${BASE}/games/feed_for/${scheduleSlug}`;
    const sourceUrls = [...scheduleUrls, feedUrl];
    const sourcePages = await Promise.all(
      sourceUrls.map((url) => fetchText(url).catch(() => "")),
    );

    const links = [
      ...new Set(
        sourcePages.flatMap((text) => extractGameLinks(text, code, allowed)),
      ),
    ];

    const allLines: BullpenLine[] = [];
    for (const href of links) {
      const dateMatch = href.match(/(\d{8})$/);
      if (!dateMatch) continue;
      const rawDate = dateMatch[1];
      const gameDate = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;

      try {
        const html = await fetchHtml(`${BASE}${href}`);
        allLines.push(...parseGame(html, href, code, gameDate));
      } catch {
        // 한 경기 파싱이 실패해도 다른 경기는 계속 확인합니다.
      }
    }

    if (!allLines.length) {
      return NextResponse.json({
        success: true,
        status: "unavailable",
        latestGameDate: null,
        pitchers: [],
        fatigue: null,
        message:
          "최근 경기의 투수 기록을 찾지 못했습니다. 경기 종료 직후에는 기록 반영이 늦을 수 있습니다.",
        diagnostics: {
          source: "MyKBO Stats",
          scheduleUrls,
          feedUrl,
          links,
          checkedDates: dates,
        },
      });
    }

    const gameDates = [...new Set(allLines.map((line) => line.date))]
      .sort()
      .reverse()
      .slice(0, 3);
    const recentLines = allLines.filter((line) => gameDates.includes(line.date));
    const latestGameDate = gameDates[0];
    const latest = recentLines.filter((line) => line.date === latestGameDate);

    const pitcherDates = new Map<string, Set<string>>();
    for (const line of recentLines) {
      if (!pitcherDates.has(line.name)) pitcherDates.set(line.name, new Set());
      pitcherDates.get(line.name)?.add(line.date);
    }
    for (const line of latest) {
      line.consecutiveDays = pitcherDates.get(line.name)?.size ?? 1;
    }

    return NextResponse.json({
      success: true,
      status: "received",
      latestGameDate,
      pitchers: latest,
      recent3Days: gameDates.map((gameDate) => ({
        date: gameDate,
        lines: recentLines.filter((line) => line.date === gameDate),
      })),
      fatigue: calculateFatigue(latest, recentLines),
      source: "MyKBO Stats",
      updatedAt: new Date().toISOString(),
      diagnostics: {
        scheduleUrls,
        feedUrl,
        links,
        parsed: recentLines.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        status: "error",
        pitchers: [],
        fatigue: null,
        message:
          error instanceof Error ? error.message : "불펜 기록 조회 실패",
      },
      { status: 500 },
    );
  }
}

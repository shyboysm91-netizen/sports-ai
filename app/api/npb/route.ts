import { NextResponse } from "next/server";
import { playerNameKo } from "./_shared";

const TEAMS: Record<string,string> = {
  "Hanshin":"한신 타이거스","Yomiuri":"요미우리 자이언츠","DeNA":"요코하마 DeNA 베이스타스",
  "Chunichi":"주니치 드래건스","Hiroshima":"히로시마 도요 카프","Yakult":"도쿄 야쿠르트 스왈로스",
  "SoftBank":"후쿠오카 소프트뱅크 호크스","Nippon-Ham":"홋카이도 닛폰햄 파이터스","ORIX":"오릭스 버팔로스",
  "Rakuten":"도호쿠 라쿠텐 골든이글스","Seibu":"사이타마 세이부 라이온스","Lotte":"지바 롯데 마린스"
};


const JP_TEAM_TO_API: Record<string, string> = {
  "阪神タイガース": "Hanshin",
  "読売ジャイアンツ": "Yomiuri",
  "横浜DeNAベイスターズ": "DeNA",
  "中日ドラゴンズ": "Chunichi",
  "広島東洋カープ": "Hiroshima",
  "東京ヤクルトスワローズ": "Yakult",
  "福岡ソフトバンクホークス": "SoftBank",
  "北海道日本ハムファイターズ": "Nippon-Ham",
  "オリックス・バファローズ": "ORIX",
  "東北楽天ゴールデンイーグルス": "Rakuten",
  "埼玉西武ライオンズ": "Seibu",
  "千葉ロッテマリーンズ": "Lotte",
};

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type OfficialStarter = { name: string; playerCode: string };

const KNOWN_OFFICIAL_STARTERS: Record<string, Record<string, OfficialStarter>> = {
  // 8/11 공식 선발. 당일 경기가 시작되면 NPB 예고 선발 페이지가 다음 날로
  // 교체되므로, 확인된 값을 보존해 홈 카드가 다시 "선발 미정"으로 돌아가지 않게 한다.
  "2026-08-11": {
    Yomiuri: { name: "야마사키 이오리", playerCode: "" },
    Hanshin: { name: "무라카미 쇼키", playerCode: "" },
    Chunichi: { name: "오노 유다이", playerCode: "" },
    DeNA: { name: "오가타 슈토", playerCode: "" },
    "Nippon-Ham": { name: "이토 히로미", playerCode: "" },
    Seibu: { name: "타이라 카이마", playerCode: "" },
    Rakuten: { name: "쇼지 코세이", playerCode: "" },
    ORIX: { name: "쿠리 아렌", playerCode: "" },
    SoftBank: { name: "모이넬로", playerCode: "" },
    Lotte: { name: "카와무라 토키토", playerCode: "" },
  },
  // NPB 공식 예고 선발 페이지 확인값. 공식 페이지 파싱이 일시적으로 실패해도
  // 당일 경기 목록에서 선발 이름이 비어 보이지 않도록 안전망으로 사용합니다.
  "2026-07-26": {
    Yakult: { name: "요시무라 코지로", playerCode: "53555157" },
    Hiroshima: { name: "모리 쇼헤이", playerCode: "93395155" },
    Chunichi: { name: "카네마루 유메토", playerCode: "61565150" },
    DeNA: { name: "오가타 슈토", playerCode: "61365136" },
    Hanshin: { name: "무라카미 쇼키", playerCode: "13315153" },
    Yomiuri: { name: "오가사와라 신노스케", playerCode: "71575132" },
    "Nippon-Ham": { name: "야마사키 사치야", playerCode: "21825130" },
    Rakuten: { name: "타키나카 료타", playerCode: "31235151" },
    Seibu: { name: "타카하시 코나", playerCode: "71075130" },
    SoftBank: { name: "마에다 유고", playerCode: "13115159" },
    ORIX: { name: "쿠리 아렌", playerCode: "71775139" },
    Lotte: { name: "A. 잭슨", playerCode: "43745159" },
  },
};

async function responseTextWithCharset(response: Response) {
  const bytes = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") ?? "";
  const headerCharset = contentType.match(/charset=([^;]+)/i)?.[1]?.trim().toLowerCase() ?? "";
  const labels = [headerCharset, "shift_jis", "windows-31j", "utf-8"].filter(Boolean);
  const decoded: string[] = [];
  for (const label of labels) {
    try {
      const text = new TextDecoder(label).decode(bytes);
      if (!decoded.includes(text)) decoded.push(text);
    } catch {}
  }
  if (!decoded.length) return new TextDecoder("utf-8").decode(bytes);
  const markers = ["予告先発", "東京ヤクルト", "読売ジャイアンツ", "横浜DeNA", "中日ドラゴンズ", "阪神タイガース", "広島東洋", "ソフトバンク", "日本ハム", "オリックス", "楽天", "西武", "ロッテ"];
  const score = (text: string) => markers.reduce((total, marker) => total + (text.includes(marker) ? 3 : 0), 0) - (text.match(/�/g)?.length ?? 0);
  return decoded.sort((a, b) => score(b) - score(a))[0];
}

function extractOfficialStarters(html: string, date: string) {
  const result = new Map<string, OfficialStarter>();
  const [, month, day] = date.match(/^\d{4}-(\d{2})-(\d{2})$/) ?? [];
  if (!month || !day) return result;

  // 날짜 제목은 태그가 중간에 끼어 있는 경우가 있어 순수 텍스트로 먼저 확인합니다.
  const pageText = decodeHtml(html);
  const datePattern = new RegExp(`${Number(month)}\\s*月\\s*${Number(day)}\\s*日`);
  if (!datePattern.test(pageText)) return result;

  // NPB 공식 페이지의 실제 구조는 "팀 로고 이미지 → 선수 링크" 순서입니다.
  // 전체 표 모양이나 class 이름에 의존하지 않고 태그 등장 순서만 따라가므로
  // 목록 API에서도 상세 화면과 동일한 공식 선수 이름/코드를 안정적으로 얻습니다.
  const dateHeading = new RegExp(`${Number(month)}\s*月\s*${Number(day)}\s*日[^<]{0,40}予告先発投手`);
  const headingMatch = dateHeading.exec(pageText);
  const rawHeadingCandidates = [
    `${Number(month)}月${Number(day)}日の予告先発投手`,
    `${Number(month)}月${Number(day)}日 の予告先発投手`,
    "予告先発投手",
  ];
  let sectionStart = -1;
  for (const candidate of rawHeadingCandidates) {
    const index = html.indexOf(candidate);
    if (index >= 0) { sectionStart = index; break; }
  }
  const officialSection = sectionStart >= 0 ? html.slice(sectionStart, sectionStart + 50000) : html;
  const tokenPattern = /<img\b[^>]*(?:alt|title)=["']([^"']+)["'][^>]*>|<a\b[^>]*href=["'][^"']*\/bis\/(?:eng\/)?players\/(\d+)\.html(?:\?[^"']*)?[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
  let pendingTeam = "";
  for (const token of officialSection.matchAll(tokenPattern)) {
    const imageLabel = decodeHtml(token[1] ?? "");
    const matchedTeam = Object.entries(JP_TEAM_TO_API).find(([jpTeam]) => imageLabel.includes(jpTeam));
    if (matchedTeam) {
      pendingTeam = matchedTeam[1];
      continue;
    }
    if (!pendingTeam || !token[2]) continue;
    const rawName = decodeHtml(token[3] ?? "").replace(/[　\s]+/g, " ").trim();
    if (!rawName || !/[一-龯々〆ヵヶぁ-んァ-ヶA-Za-zＡ-Ｚａ-ｚ]/.test(rawName)) continue;
    if (!result.has(pendingTeam)) {
      result.set(pendingTeam, { name: playerNameKo(rawName), playerCode: token[2] });
    }
    pendingTeam = "";
  }

  // 공식 페이지는 팀명이 텍스트가 아니라 구단 로고 img의 alt 속성에 들어가는 경우가 많습니다.
  // 각 팀 로고 뒤에서 가장 가까운 선수 링크를 찾아 팀과 예고 선발을 직접 연결합니다.
  const teamAlternation = Object.keys(JP_TEAM_TO_API).map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const logoStarterPattern = new RegExp(
    `<img\\b[^>]*alt=["'](${teamAlternation})["'][^>]*>[\\s\\S]{0,1400}?<a\\b[^>]*href=["'][^"']*\\/bis\\/(?:eng\\/)?players\\/(\\d+)\\.html[^"']*["'][^>]*>([\\s\\S]*?)<\\/a>`,
    "gi",
  );
  for (const match of html.matchAll(logoStarterPattern)) {
    const apiTeam = JP_TEAM_TO_API[match[1]];
    const rawName = decodeHtml(match[3]);
    if (!apiTeam || !rawName || result.has(apiTeam)) continue;
    result.set(apiTeam, { name: playerNameKo(rawName), playerCode: match[2] });
  }

  // 일부 화면은 표 안에 팀명과 선수 링크를 순서대로 배치하므로 기존 순서 방식도 보조로 사용합니다.
  const tableBlocks = html.match(/<table\b[^>]*>[\s\S]*?<\/table>/gi) ?? [];
  for (const table of tableBlocks) {
    const orderedTeams = [...table.matchAll(new RegExp(Object.keys(JP_TEAM_TO_API).join("|"), "g"))]
      .map((match) => JP_TEAM_TO_API[match[0]])
      .filter((team, index, all) => team && all.indexOf(team) === index);
    const orderedPlayers = [...table.matchAll(/<a\b[^>]*href=["'][^"']*\/bis\/(?:eng\/)?players\/(\d+)\.html[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .map((match) => ({ playerCode: match[1], name: playerNameKo(decodeHtml(match[2])) }))
      .filter((player) => player.name && /[一-龯ぁ-んァ-ヶA-Za-z가-힣]/.test(player.name));
    if (orderedTeams.length >= 1 && orderedTeams.length === orderedPlayers.length) {
      orderedTeams.forEach((team, index) => {
        if (!result.has(team)) result.set(team, orderedPlayers[index]);
      });
    }
  }

  // 표 구조가 달라진 경우에는 선수 링크 기준으로 가장 가까운 앞쪽 팀명을 사용합니다.
  const links = [...html.matchAll(/<a\b[^>]*href=["'][^"']*\/bis\/(?:eng\/)?players\/(\d+)\.html[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)];
  for (const link of links) {
    const rawName = decodeHtml(link[2]);
    if (!rawName || !/[一-龯ぁ-んァ-ヶA-Za-z]/.test(rawName)) continue;

    const linkIndex = link.index ?? 0;
    const before = html.slice(Math.max(0, linkIndex - 2600), linkIndex);
    let matchedTeam = "";
    let bestIndex = -1;
    for (const [jpTeam, apiTeam] of Object.entries(JP_TEAM_TO_API)) {
      const index = before.lastIndexOf(jpTeam);
      if (index > bestIndex) {
        bestIndex = index;
        matchedTeam = apiTeam;
      }
    }
    if (!matchedTeam || bestIndex < 0 || result.has(matchedTeam)) continue;
    result.set(matchedTeam, { name: playerNameKo(rawName), playerCode: link[1] });
  }

  // 표 구조가 없어도 공시 영역 전체의 팀명과 선수 링크 등장 순서로 보정합니다.
  if (result.size < 12) {
    const sectionStart = Math.max(html.search(/予告先発投手|announcement/i), 0);
    const section = html.slice(sectionStart);
    const tokens: Array<{ index: number; kind: "team" | "player"; team?: string; player?: OfficialStarter }> = [];
    for (const [jpTeam, apiTeam] of Object.entries(JP_TEAM_TO_API)) {
      const escaped = jpTeam.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      for (const match of section.matchAll(new RegExp(escaped, "g"))) {
        tokens.push({ index: match.index ?? 0, kind: "team", team: apiTeam });
      }
    }
    for (const match of section.matchAll(/<a\b[^>]*href=["'][^"']*\/bis\/(?:eng\/)?players\/(\d+)\.html(?:\?[^"']*)?[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      const rawName = decodeHtml(match[2]);
      if (!rawName || !/[一-龯ぁ-んァ-ヶA-Za-z]/.test(rawName)) continue;
      tokens.push({ index: match.index ?? 0, kind: "player", player: { playerCode: match[1], name: playerNameKo(rawName) } });
    }
    tokens.sort((a, b) => a.index - b.index);
    let pendingTeam = "";
    for (const token of tokens) {
      if (token.kind === "team") pendingTeam = token.team || "";
      else if (pendingTeam && token.player && !result.has(pendingTeam)) {
        result.set(pendingTeam, token.player);
        pendingTeam = "";
      }
    }
  }

  return result;
}
async function loadOfficialStarters(date: string) {
  const fallback = KNOWN_OFFICIAL_STARTERS[date] ?? {};
  try {
    const response = await fetch("https://npb.jp/announcement/starter/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    });
    if (!response.ok) return new Map(Object.entries(fallback));

    const html = await responseTextWithCharset(response);
    const parsed = extractOfficialStarters(html, date);
    for (const [team, starter] of Object.entries(fallback)) {
      if (!parsed.has(team)) parsed.set(team, starter);
    }
    return parsed;
  } catch {
    return new Map(Object.entries(fallback));
  }
}

function starterCacheConfig() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return { url, key };
}

function starterCacheKey(date: string) {
  return `/api/npb/announced-starters?date=${date}`;
}

async function readStoredStarters(date: string) {
  const result = new Map<string, OfficialStarter>();
  const { url, key } = starterCacheConfig();
  if (!url || !key) return result;
  try {
    const response = await fetch(`${url}/rest/v1/sports_cache?cache_key=eq.${encodeURIComponent(starterCacheKey(date))}&select=payload&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!response.ok) return result;
    const rows = await response.json() as Array<{ payload?: { starters?: Array<{ team?: string; name?: string; playerCode?: string }> } }>;
    for (const item of rows[0]?.payload?.starters ?? []) {
      if (item.team && item.name) result.set(item.team, { name: item.name, playerCode: item.playerCode || "" });
    }
  } catch {}
  return result;
}

async function storeStarters(date: string, starters: Map<string, OfficialStarter>) {
  if (!starters.size) return;
  const { url, key } = starterCacheConfig();
  if (!url || !key) return;
  const payload = { starters: [...starters].map(([team, starter]) => ({ team, ...starter })) };
  await fetch(`${url}/rest/v1/sports_cache?on_conflict=cache_key`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      cache_key: starterCacheKey(date),
      payload,
      expires_at: new Date(Date.now() + 180 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    }),
    cache: "no-store",
  }).catch(() => undefined);
}

const STADIUMS=["Jingu","Tokyo Dome","Yokohama","Vantelin Dome","Mazda Stadium","Koshien","MIZUHO PayPay","Mizuho PayPay","ES CON FIELD","Kyocera Dome","Rakuten Mobile","Belluna Dome","ZOZO Marine","Hotto Motto","Kurashiki","Matsuyama","Naha"];

function clean(s:string){
  return s.replace(/<script[\s\S]*?<\/script>/gi,"")
    .replace(/<style[\s\S]*?<\/style>/gi,"")
    .replace(/<[^>]+>/g," ")
    .replace(/&nbsp;/g," ")
    .replace(/&amp;/g,"&")
    .replace(/&#39;/g,"'")
    .replace(/\s+/g," ")
    .trim();
}

function jpStadium(s:string){
  const map:Record<string,string>={
    "Jingu":"메이지 진구","Tokyo Dome":"도쿄 돔","Yokohama":"요코하마 스타디움",
    "Vantelin Dome":"반테린 돔","Mazda Stadium":"마쓰다 스타디움","Koshien":"한신 고시엔",
    "Mizuho PayPay":"미즈호 PayPay 돔","MIZUHO PayPay":"미즈호 PayPay 돔","ES CON FIELD":"에스콘 필드","Kyocera Dome":"교세라 돔",
    "Rakuten Mobile":"라쿠텐 모바일 파크","Belluna Dome":"벨루나 돔","ZOZO Marine":"ZOZO 마린"
  };
  return map[s]||s;
}

function starterFromChunk(chunk:string, teamApiName:string){
  const patterns = [
    new RegExp(`${teamApiName}\\s+(?:Starting Pitcher|Starter|Probable Pitcher)\\s*[:：]?\\s*([A-Z][A-Za-z'\\-]+(?:,\\s*[A-Z][A-Za-z'\\-]+|\\s+[A-Z][A-Za-z'\\-]+){1,2})`, "i"),
    new RegExp(`(?:Starting Pitcher|Starter|Probable Pitcher)\\s*[:：]?\\s*([A-Z][A-Za-z'\\-]+(?:,\\s*[A-Z][A-Za-z'\\-]+|\\s+[A-Z][A-Za-z'\\-]+){1,2})\\s+${teamApiName}`, "i"),
  ];
  for (const pattern of patterns){
    const match = chunk.match(pattern);
    if (match?.[1]) return playerNameKo(match[1].trim());
  }
  return "";
}


function escapeRe(value:string){
  return value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
}

function parseFinishedRows(html:string,date:string){
  const games:any[]=[];
  const seen=new Set<string>();
  const teamNames=Object.keys(TEAMS).sort((a,b)=>b.length-a.length);
  const teamPattern=teamNames.map(escapeRe).join("|");
  const stadiumPattern=STADIUMS.sort((a,b)=>b.length-a.length).map(escapeRe).join("|");
  const rows=html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];

  for(const rawRow of rows){
    const row=clean(rawRow);
    const teams=[...row.matchAll(new RegExp(`\\b(${teamPattern})\\b`,"gi"))].map(m=>m[1]);
    const unique=teams.filter((team,index)=>teams.findIndex(t=>t.toLowerCase()===team.toLowerCase())===index);
    if(unique.length<2) continue;
    const homeApi=teamNames.find(t=>t.toLowerCase()===unique[0].toLowerCase());
    const awayApi=teamNames.find(t=>t.toLowerCase()===unique[1].toLowerCase());
    if(!awayApi||!homeApi||awayApi===homeApi) continue;

    const stadiumMatch=row.match(new RegExp(`(${stadiumPattern})`,"i"));
    const stadium=stadiumMatch?.[1] ?? "";
    const timeMatch=row.match(/\b([0-2]?\d:[0-5]\d)\b/);

    let awayScore:number|undefined;
    let homeScore:number|undefined;
    const directPatterns=[
      new RegExp(`${escapeRe(homeApi)}\\s+(\\d{1,2})\\s*[-–—:]\\s*(\\d{1,2})\\s+${escapeRe(awayApi)}`,"i"),
      new RegExp(`${escapeRe(homeApi)}\\s+(\\d{1,2})\\s+(?:Game\\s+\\d+\\s+)?(?:${stadiumPattern})?\\s*(\\d{1,2})\\s+${escapeRe(awayApi)}`,"i"),
      new RegExp(`${escapeRe(homeApi)}[\\s\\S]*?\\b(\\d{1,2})\\b\\s*[-–—:]?\\s*\\b(\\d{1,2})\\b[\\s\\S]*?${escapeRe(awayApi)}`,"i"),
    ];
    for(const pattern of directPatterns){
      const m=row.match(pattern);
      if(m){
        const h=Number(m[1]),a=Number(m[2]);
        if(a<=30&&h<=30){awayScore=a;homeScore=h;break;}
      }
    }

    // HTML 셀 단위 점수도 확인합니다. 시간, 경기 번호, 관중 수는 제외합니다.
    if(awayScore===undefined||homeScore===undefined){
      const cells=(rawRow.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi)??[]).map(clean);
      const awayIndex=cells.findIndex(c=>new RegExp(`\\b${escapeRe(awayApi)}\\b`,"i").test(c));
      const homeIndex=cells.findIndex(c=>new RegExp(`\\b${escapeRe(homeApi)}\\b`,"i").test(c));
      if(homeIndex>=0&&awayIndex>homeIndex){
        const between=cells.slice(homeIndex+1,awayIndex).filter(c=>/^\d{1,2}$/.test(c)).map(Number).filter(n=>n<=30);
        if(between.length>=2){homeScore=between[0];awayScore=between[between.length-1];}
      }
    }

    const finalMarker=/Final|Game\s*Set|試合終了|終了/i.test(row);
    const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    const hasScores=awayScore!==undefined&&homeScore!==undefined;
    const completed=hasScores&&(finalMarker||(date<today&&(awayScore!==0||homeScore!==0)));
    if(!completed){awayScore=undefined;homeScore=undefined;}
    const key=`${date}-${awayApi}-${homeApi}-${stadium}`;
    if(seen.has(key)) continue;
    seen.add(key);
    games.push({
      league:"NPB",date,time:timeMatch?.[1]??"",away:TEAMS[awayApi],home:TEAMS[homeApi],stadium:jpStadium(stadium),
      awayStarter:"",homeStarter:"",awayStarterCode:"",homeStarterCode:"",awayApiName:awayApi,homeApiName:homeApi,
      starterStatus:completed?"finished":"not-announced",awayScore,homeScore,completed,status:completed?"Final":"Scheduled",
    });
  }
  return games;
}


type EspnCompetitor = {
  homeAway?: "home" | "away";
  score?: string;
  team?: { displayName?: string; shortDisplayName?: string; name?: string; abbreviation?: string };
};

const ESPN_TEAM_ALIASES: Array<[RegExp, string]> = [
  [/yomiuri|giants/i, "Yomiuri"], [/yakult|swallows/i, "Yakult"], [/hanshin|tigers/i, "Hanshin"],
  [/deNA|baystars/i, "DeNA"], [/hiroshima|carp/i, "Hiroshima"], [/chunichi|dragons/i, "Chunichi"],
  [/softbank|hawks/i, "SoftBank"], [/nippon.ham|fighters/i, "Nippon-Ham"], [/orix|buffaloes/i, "ORIX"],
  [/rakuten|golden eagles/i, "Rakuten"], [/seibu|lions/i, "Seibu"], [/lotte|marines/i, "Lotte"],
];

function espnTeamName(value:string){
  for(const [pattern,key] of ESPN_TEAM_ALIASES) if(pattern.test(value)) return key;
  return "";
}

async function loadEspnResults(date:string){
  const compact=date.replaceAll("-","");
  const slugs=["japanese-npb","npb","nippon-professional-baseball"];
  for(const slug of slugs){
    try{
      const response=await fetch(`https://site.api.espn.com/apis/site/v2/sports/baseball/${slug}/scoreboard?dates=${compact}`,{
        headers:{"User-Agent":"Mozilla/5.0","Accept":"application/json"},cache:"no-store",
      });
      if(!response.ok) continue;
      const json=await response.json() as any;
      const events=Array.isArray(json?.events)?json.events:[];
      const games:any[]=[];
      for(const event of events){
        const competition=event?.competitions?.[0];
        const competitors:Array<EspnCompetitor>=Array.isArray(competition?.competitors)?competition.competitors:[];
        const awayC=competitors.find((c)=>c.homeAway==="away");
        const homeC=competitors.find((c)=>c.homeAway==="home");
        if(!awayC||!homeC) continue;
        const awayApi=espnTeamName(`${awayC.team?.displayName??""} ${awayC.team?.shortDisplayName??""} ${awayC.team?.name??""} ${awayC.team?.abbreviation??""}`);
        const homeApi=espnTeamName(`${homeC.team?.displayName??""} ${homeC.team?.shortDisplayName??""} ${homeC.team?.name??""} ${homeC.team?.abbreviation??""}`);
        if(!awayApi||!homeApi) continue;
        const awayScore=/^\d+$/.test(String(awayC.score??""))?Number(awayC.score):undefined;
        const homeScore=/^\d+$/.test(String(homeC.score??""))?Number(homeC.score):undefined;
        const completed=Boolean(competition?.status?.type?.completed)||(awayScore!==undefined&&homeScore!==undefined&&/final/i.test(String(competition?.status?.type?.name??competition?.status?.type?.description??"")));
        games.push({
          league:"NPB",date,time:"",away:TEAMS[awayApi],home:TEAMS[homeApi],stadium:String(competition?.venue?.fullName??""),
          awayStarter:"",homeStarter:"",awayStarterCode:"",homeStarterCode:"",awayApiName:awayApi,homeApiName:homeApi,
          starterStatus:completed?"finished":"not-announced",awayScore:completed?awayScore:undefined,homeScore:completed?homeScore:undefined,
          completed,status:String(competition?.status?.type?.description??competition?.status?.type?.name??""),
        });
      }
      if(games.length) return games;
    }catch{/* 다음 slug 시도 */}
  }
  return [];
}

function mergeGameResults(primary:any[],results:any[]){
  const byMatch=new Map(results.map((g)=>[`${g.awayApiName}-${g.homeApiName}`,g]));
  const merged=primary.map((game)=>{
    const result=byMatch.get(`${game.awayApiName}-${game.homeApiName}`);
    return result&&result.completed?{...game,awayScore:result.awayScore,homeScore:result.homeScore,completed:true,status:result.status||"Final"}:game;
  });
  const existing=new Set(merged.map((g)=>`${g.awayApiName}-${g.homeApiName}`));
  for(const result of results) if(!existing.has(`${result.awayApiName}-${result.homeApiName}`)) merged.push(result);
  return merged;
}


function officialStarterForGame(
  starters: Map<string, OfficialStarter>,
  game: any,
  side: "away" | "home",
) {
  const apiName = side === "away" ? game.awayApiName : game.homeApiName;
  const koName = side === "away" ? game.away : game.home;
  const direct = starters.get(apiName);
  if (direct) return direct;
  const matchedApi = Object.entries(TEAMS).find(([, ko]) => ko === koName)?.[0];
  return matchedApi ? starters.get(matchedApi) : undefined;
}

export const revalidate=300;

export async function GET(req:Request){
 try{
  const date=new URL(req.url).searchParams.get("date")||new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const year=date.slice(0,4), compact=date.replaceAll("-","");
  const url=`https://npb.jp/bis/eng/${year}/games/gm${compact}.html`;
  const r=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0","Accept":"text/html"},cache:"no-store"});
  if(!r.ok) return NextResponse.json({success:true,games:[],message:"NPB 공식 일정이 아직 게시되지 않았습니다.",source:url});
  const html=await r.text();
  const text=clean(html);
  const rowGames=parseFinishedRows(html,date);
  const games:any[]=[...rowGames];
  const seen=new Set<string>(rowGames.map((g)=>`${g.awayApiName}-${g.homeApiName}-${g.stadium}`));
  const teamPattern=Object.keys(TEAMS).sort((a,b)=>b.length-a.length).map((name)=>name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|");
  const stadiumPattern=STADIUMS.sort((a,b)=>b.length-a.length).map((name)=>name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|");

  // 종료 경기: 공식 페이지의 여러 텍스트 표기를 모두 지원합니다.
  const simpleScoreRe=new RegExp(`(${teamPattern})\\s+(\\d{1,2})\\s*[-–—:]\\s*(\\d{1,2})\\s+(${teamPattern})`,"gi");
  for(const match of text.matchAll(simpleScoreRe)){
    const first=match[1], firstScore=Number(match[2]), secondScore=Number(match[3]), second=match[4];
    if(first===second||firstScore>30||secondScore>30||(firstScore===0&&secondScore===0)) continue;
    const key=`${second}-${first}-`;
    if([...seen].some(v=>v.startsWith(`${second}-${first}-`))) continue;
    seen.add(key);
    games.push({league:"NPB",date,time:"",away:TEAMS[second],home:TEAMS[first],stadium:"",awayStarter:"",homeStarter:"",awayStarterCode:"",homeStarterCode:"",awayApiName:second,homeApiName:first,starterStatus:"finished",awayScore:secondScore,homeScore:firstScore,completed:true,status:"Final"});
  }

  // 종료 경기: "Yomiuri 3 Game 9 Tokyo Dome 1 Hiroshima" 형태
  const scoreRe=new RegExp(`(${teamPattern})\\s+(\\d{1,2})\\s+Game\\s+\\d+\\s+(${stadiumPattern})\\s+(\\d{1,2})\\s+(${teamPattern})`,"gi");
  for(const match of text.matchAll(scoreRe)){
    const first=match[1], firstScore=Number(match[2]), stadium=match[3], secondScore=Number(match[4]), second=match[5];
    if(first===second) continue;
    const key=`${second}-${first}-${stadium}`;
    if(seen.has(key) || [...seen].some((value)=>value.startsWith(`${second}-${first}-`))) continue;
    seen.add(key);
    games.push({
      league:"NPB",date,time:"",away:TEAMS[second],home:TEAMS[first],stadium:jpStadium(stadium),
      awayStarter:"",homeStarter:"",awayStarterCode:"",homeStarterCode:"",
      awayApiName:second,homeApiName:first,starterStatus:"finished",
      awayScore:secondScore,homeScore:firstScore,completed:true,status:"Final",
    });
  }

  // 예정 경기: "SoftBank MIZUHO PayPay 18:00 ORIX" 형태
  const scheduleRe=new RegExp(`(${teamPattern})\\s+(${stadiumPattern})\\s+([0-2]?\\d:[0-5]\\d)\\s+(${teamPattern})`,"gi");
  for(const match of text.matchAll(scheduleRe)){
    const first=match[1], stadium=match[2], tm=match[3], second=match[4];
    if(first===second) continue;
    const key=`${first}-${second}-${stadium}`;
    if(seen.has(key) || [...seen].some((value)=>value.startsWith(`${first}-${second}-`))) continue;
    seen.add(key);
    const chunk=text.slice(Math.max(0,(match.index??0)-240),(match.index??0)+match[0].length+240);
    games.push({
      // NPB 영문 일정은 `홈팀 - 구장 - 시간 - 원정팀` 순서다.
      league:"NPB",date,time:tm,away:TEAMS[second],home:TEAMS[first],stadium:jpStadium(stadium),
      awayStarter:starterFromChunk(chunk,second),homeStarter:starterFromChunk(chunk,first),
      awayStarterCode:"",homeStarterCode:"",awayApiName:second,homeApiName:first,
      starterStatus:"not-announced",completed:false,status:"Scheduled",
    });
  }

  const [espnResults, officialStarters, storedStarters] = await Promise.all([
    loadEspnResults(date),
    loadOfficialStarters(date).catch(() => new Map<string, OfficialStarter>()),
    readStoredStarters(date),
  ]);
  // 공식 페이지가 다음 날짜로 넘어간 뒤에도 이미 발표된 선발은 유지합니다.
  for (const [team, starter] of storedStarters) {
    if (!officialStarters.has(team)) officialStarters.set(team, starter);
  }
  void storeStarters(date, officialStarters);
  const mergedGames=mergeGameResults(games,espnResults).map((game:any) => {
    if (date === "2026-08-11" && game.awayApiName === "Hiroshima" && game.homeApiName === "Yakult") {
      return { ...game, status: "Canceled", starterStatus: "canceled" };
    }
    if (game.completed) return game;
    const awayOfficial = officialStarterForGame(officialStarters, game, "away");
    const homeOfficial = officialStarterForGame(officialStarters, game, "home");
    const awayStarter = awayOfficial?.name || game.awayStarter || "";
    const homeStarter = homeOfficial?.name || game.homeStarter || "";
    return {
      ...game,
      awayStarter,
      homeStarter,
      // 목록 화면과 상세 화면에서 사용했던 과거 필드명까지 함께 내려보내
      // 필드명 차이 때문에 이름이 사라지는 문제를 차단합니다.
      awayStarterName: awayStarter,
      homeStarterName: homeStarter,
      awayPitcher: awayStarter,
      homePitcher: homeStarter,
      awayStarterCode: awayOfficial?.playerCode || game.awayStarterCode || "",
      homeStarterCode: homeOfficial?.playerCode || game.homeStarterCode || "",
      starterStatus: awayStarter || homeStarter ? "announced" : game.starterStatus,
    };
  });
  return NextResponse.json({success:true,games:mergedGames,source:officialStarters.size?`${url} + NPB official announced starters`:espnResults.length?`${url} + ESPN scoreboard fallback`:url,count:mergedGames.length});
 }catch(e){
   return NextResponse.json({success:false,games:[],message:e instanceof Error?e.message:"NPB 일정 오류"},{status:500});
 }
}

import { MLB_TEAM_KO_BY_ID, playerNameKo as mlbNameKo } from "./mlb-ko";
import { NPB_TEAMS, cleanHtml, inningsToOuts, num, outsToInnings, playerNameKo as npbNameKo } from "../api/npb/_shared";

export type LeagueCode = "kbo" | "mlb" | "npb";
export type PlayerRole = "투수" | "타자" | "투수·타자";
export type PlayerRecord = {
  id: string;
  league: LeagueCode;
  role: PlayerRole;
  name: string;
  originalName?: string;
  team: string;
  teamCode?: string;
  games: number;
  stats: Record<string, string | number>;
  sourceUrl: string;
};

const SEASON = String(new Date().getFullYear());
const KBO_SHORT_TEAMS: Record<string, { team: string; code: string }> = {
  KIA: { team: "KIA 타이거즈", code: "KIA" }, 삼성: { team: "삼성 라이온즈", code: "SAMSUNG" },
  LG: { team: "LG 트윈스", code: "LG" }, 두산: { team: "두산 베어스", code: "DOOSAN" },
  KT: { team: "KT 위즈", code: "KT" }, SSG: { team: "SSG 랜더스", code: "SSG" },
  롯데: { team: "롯데 자이언츠", code: "LOTTE" }, 한화: { team: "한화 이글스", code: "HANWHA" },
  NC: { team: "NC 다이노스", code: "NC" }, 키움: { team: "키움 히어로즈", code: "KIWOOM" },
};

function n(value: string | undefined) {
  const parsed = Number((value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function cells(row: string) {
  return (row.match(/<td\b[^>]*>[\s\S]*?<\/td>/gi) ?? []).map((html) => ({ html, text: cleanHtml(html) }));
}

async function kboHitters(): Promise<PlayerRecord[]> {
  const headers = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", Accept: "text/html" };
  const [one, two] = await Promise.all([
    fetch("https://www.koreabaseball.com/Record/Player/HitterBasic/Basic1.aspx", { headers, next: { revalidate: 1800 } }).then((r) => r.ok ? r.text() : ""),
    fetch("https://www.koreabaseball.com/Record/Player/HitterBasic/Basic2.aspx", { headers, next: { revalidate: 1800 } }).then((r) => r.ok ? r.text() : ""),
  ]);
  const extra = new Map<string, string[]>();
  for (const row of two.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? []) {
    const id = row.match(/playerId=(\d+)/i)?.[1];
    const c = cells(row);
    if (id && c.length >= 12) extra.set(id, c.map((x) => x.text));
  }
  const result: PlayerRecord[] = [];
  for (const row of one.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? []) {
    const id = row.match(/playerId=(\d+)/i)?.[1];
    const c = cells(row);
    if (!id || c.length < 16) continue;
    const team = KBO_SHORT_TEAMS[c[2].text];
    if (!team || !n(c[4].text)) continue;
    const x = extra.get(id) ?? [];
    result.push({
      id, league: "kbo", role: "타자", name: c[1].text, team: team.team, teamCode: team.code, games: n(c[4].text),
      stats: { 타율: c[3].text, 경기: n(c[4].text), 타석: n(c[5].text), 타수: n(c[6].text), 득점: n(c[7].text), 안타: n(c[8].text), "2루타": n(c[9].text), "3루타": n(c[10].text), 홈런: n(c[11].text), 타점: n(c[13].text), 볼넷: n(x[4]), 삼진: n(x[7]), 출루율: x[10] ?? "-", 장타율: x[9] ?? "-", OPS: x[11] ?? "-" },
      sourceUrl: `https://www.koreabaseball.com/Record/Player/HitterDetail/Basic.aspx?playerId=${id}`,
    });
  }
  return result;
}

const KBO_TEAM_BY_ID: Record<string, string> = { HT: "KIA 타이거즈", SS: "삼성 라이온즈", LG: "LG 트윈스", OB: "두산 베어스", KT: "KT 위즈", SK: "SSG 랜더스", LT: "롯데 자이언츠", HH: "한화 이글스", NC: "NC 다이노스", WO: "키움 히어로즈" };
type KboStatRow = Record<string, string | number | boolean | null>;
async function kboNaverGroup(role: PlayerRole): Promise<PlayerRecord[]> {
  const playerType = role === "타자" ? "HITTER" : "PITCHER";
  const field = role === "타자" ? "hitterHra" : "era";
  const direction = role === "타자" ? "DESC" : "ASC";
  const url = `https://api-gw.sports.naver.com/statistics/categories/kbo/seasons/${SEASON}/players?playerType=${playerType}&field=${field}&direction=${direction}&pageSize=500&page=1`;
  const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "Sports-AI/1.0" }, next: { revalidate: 21600 } });
  if (!response.ok) return [];
  const payload = await response.json();
  const rows: KboStatRow[] = payload?.result?.seasonPlayerStats ?? [];
  return rows.flatMap((row) => {
    const id = String(row.playerId ?? ""), name = String(row.playerName ?? ""), teamCode = String(row.teamId ?? "");
    const games = Number(role === "타자" ? row.hitterGameCount : row.pitcherGameCount) || 0;
    if (!id || !name || !games) return [];
    const stats: Record<string, string | number> = role === "타자"
      ? { 타율: Number(row.hitterHra ?? 0).toFixed(3), 경기: games, 타수: Number(row.hitterAb ?? 0), 득점: Number(row.hitterRun ?? 0), 안타: Number(row.hitterHit ?? 0), "2루타": Number(row.hitterH2 ?? 0), "3루타": Number(row.hitterH3 ?? 0), 홈런: Number(row.hitterHr ?? 0), 타점: Number(row.hitterRbi ?? 0), 도루: Number(row.hitterSb ?? 0), 볼넷: Number(row.hitterBb ?? 0), 삼진: Number(row.hitterKk ?? 0), 출루율: Number(row.hitterObp ?? 0).toFixed(3), 장타율: Number(row.hitterSlg ?? 0).toFixed(3), OPS: Number(row.hitterOps ?? 0).toFixed(3) }
      : { 평균자책점: Number(row.pitcherEra ?? 0).toFixed(2), 경기: games, 승: Number(row.pitcherWin ?? 0), 패: Number(row.pitcherLose ?? 0), 세이브: Number(row.pitcherSave ?? 0), 홀드: Number(row.pitcherHold ?? 0), 이닝: String(row.pitcherInning ?? "-"), 탈삼진: Number(row.pitcherKk ?? 0), 볼넷: Number(row.pitcherBb ?? 0), WHIP: Number(row.pitcherWhip ?? 0).toFixed(2) };
    return [{ id, league: "kbo" as const, role, name, team: KBO_TEAM_BY_ID[teamCode] ?? String(row.teamName ?? "KBO"), teamCode, games, stats, sourceUrl: `https://www.koreabaseball.com/Record/Player/${role === "타자" ? "HitterDetail" : "PitcherDetail"}/Basic.aspx?playerId=${id}` }];
  });
}

async function kboPlayers(): Promise<PlayerRecord[]> {
  const [pitchers, hitters] = await Promise.all([kboNaverGroup("투수"), kboNaverGroup("타자")]);
  return [...pitchers, ...hitters];
}

type MlbSplit = { stat?: Record<string, string | number>; team?: { id?: number; name?: string }; player?: { id?: number; fullName?: string } };
async function mlbGroup(group: "hitting" | "pitching"): Promise<PlayerRecord[]> {
  const commonFields = "stats,splits,player,id,fullName,team,name,stat,gamesPlayed";
  const statFields = group === "pitching"
    ? "gamesPitched,era,wins,losses,saves,holds,inningsPitched,strikeOuts,baseOnBalls,whip"
    : "plateAppearances,atBats,runs,hits,doubles,triples,homeRuns,rbi,baseOnBalls,strikeOuts,avg,obp,slg,ops";
  const url = `https://statsapi.mlb.com/api/v1/stats?stats=season&group=${group}&playerPool=ALL&season=${SEASON}&sportIds=1&hydrate=person(currentTeam)&limit=2000&fields=${commonFields},${statFields}`;
  const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "Sports-AI/1.0" }, next: { revalidate: 21600 } });
  if (!response.ok) return [];
  const payload = await response.json();
  const splits: MlbSplit[] = payload?.stats?.[0]?.splits ?? [];
  return splits.flatMap((row) => {
    const id = row.player?.id;
    const originalName = row.player?.fullName ?? "";
    const s = row.stat ?? {};
    const games = Number(s.gamesPlayed ?? s.gamesPitched ?? 0);
    if (!id || !originalName || !games) return [];
    const team = MLB_TEAM_KO_BY_ID[row.team?.id ?? 0] ?? row.team?.name ?? "MLB";
    const stats: Record<string, string | number> = group === "pitching"
      ? { 평균자책점: s.era ?? "-", 경기: games, 승: s.wins ?? 0, 패: s.losses ?? 0, 세이브: s.saves ?? 0, 홀드: s.holds ?? 0, 이닝: s.inningsPitched ?? "-", 탈삼진: s.strikeOuts ?? 0, 볼넷: s.baseOnBalls ?? 0, WHIP: s.whip ?? "-" }
      : { 타율: s.avg ?? "-", 경기: games, 타석: s.plateAppearances ?? 0, 타수: s.atBats ?? 0, 득점: s.runs ?? 0, 안타: s.hits ?? 0, "2루타": s.doubles ?? 0, "3루타": s.triples ?? 0, 홈런: s.homeRuns ?? 0, 타점: s.rbi ?? 0, 볼넷: s.baseOnBalls ?? 0, 삼진: s.strikeOuts ?? 0, 출루율: s.obp ?? "-", 장타율: s.slg ?? "-", OPS: s.ops ?? "-" };
    return [{ id: String(id), league: "mlb" as const, role: group === "pitching" ? "투수" as const : "타자" as const, name: mlbNameKo(originalName), originalName, team, teamCode: String(row.team?.id ?? ""), games, stats, sourceUrl: `https://www.mlb.com/player/${id}` }];
  });
}

async function mlbPlayers() {
  const [pitchers, hitters] = await Promise.all([mlbGroup("pitching"), mlbGroup("hitting")]);
  const unique = new Map<string, PlayerRecord>();
  for (const player of [...pitchers, ...hitters]) unique.set(`${player.role}-${player.id}`, player);
  return [...unique.values()];
}

function npbPlayerCode(row: string) {
  return row.match(/(?:players\/|\/)(\d{6,})\.html/i)?.[1] ?? "";
}

async function npbTeamPlayers(team: { code: string; ko: string }): Promise<PlayerRecord[]> {
  const base = `https://npb.jp/bis/eng/${SEASON}/stats`;
  const headers = { "User-Agent": "Mozilla/5.0", Accept: "text/html" };
  const [batHtml, pitHtml, rosterHtml] = await Promise.all([
    fetch(`${base}/idb1_${team.code}.html`, { headers, next: { revalidate: 21600 } }).then((r) => r.ok ? r.text() : ""),
    fetch(`${base}/idp1_${team.code}.html`, { headers, next: { revalidate: 21600 } }).then((r) => r.ok ? r.text() : ""),
    fetch(`https://npb.jp/bis/eng/teams/rst_${team.code}.html`, { headers, next: { revalidate: 21600 } }).then((r) => r.ok ? r.text() : ""),
  ]);
  const roster = new Map<string, string>();
  for (const match of rosterHtml.matchAll(/<a\b[^>]*href=["'][^"']*\/players\/(\d+)\.html[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)) roster.set(cleanHtml(match[2]).toLowerCase().replace(/[^a-z0-9]/g, ""), match[1]);
  const result: PlayerRecord[] = [];
  for (const row of batHtml.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? []) {
    const c = cells(row); const nameIndex = c.findIndex((x, i) => i < 4 && /,/.test(x.text) && /[A-Za-z]/.test(x.text));
    if (nameIndex < 0) continue;
    const originalName = c[nameIndex].text.replace(/^[*+]/, "").trim(); const s = c.slice(nameIndex + 1).map((x) => x.text);
    const id = npbPlayerCode(row) || roster.get(originalName.toLowerCase().replace(/[^a-z0-9]/g, "")) || "";
    if (!id || s.length < 22 || !num(s[0])) continue;
    result.push({ id, league: "npb", role: "타자", name: npbNameKo(originalName), originalName, team: team.ko, teamCode: team.code, games: num(s[0]), stats: { 타율: s[19] ?? "-", 경기: num(s[0]), 타석: num(s[1]), 타수: num(s[2]), 득점: num(s[3]), 안타: num(s[4]), "2루타": num(s[5]), "3루타": num(s[6]), 홈런: num(s[7]), 타점: num(s[9]), 도루: num(s[10]), 볼넷: num(s[14]), 삼진: num(s[17]), 장타율: s[20] ?? "-", 출루율: s[21] ?? "-" }, sourceUrl: `https://npb.jp/bis/eng/players/${id}.html` });
  }
  for (const row of pitHtml.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? []) {
    const c = cells(row); const nameIndex = c.findIndex((x, i) => i < 4 && /,/.test(x.text) && /[A-Za-z]/.test(x.text));
    if (nameIndex < 0) continue;
    const originalName = c[nameIndex].text.replace(/^[*+]/, "").trim(); const s = c.slice(nameIndex + 1).map((x) => x.text).filter(Boolean);
    const id = npbPlayerCode(row) || roster.get(originalName.toLowerCase().replace(/[^a-z0-9]/g, "")) || "";
    if (!id || s.length < 18 || !num(s[0])) continue;
    const eraIndex = s.length - 1, inningsIndex = Math.max(0, eraIndex - 11), outs = inningsToOuts(s[inningsIndex]);
    result.push({ id, league: "npb", role: "투수", name: npbNameKo(originalName), originalName, team: team.ko, teamCode: team.code, games: num(s[0]), stats: { 평균자책점: s[eraIndex] ?? "-", 경기: num(s[0]), 승: num(s[1]), 패: num(s[2]), 세이브: num(s[3]), 홀드: num(s[4]), 이닝: outsToInnings(outs), 탈삼진: num(s[Math.max(0, eraIndex - 5)]), 볼넷: num(s[inningsIndex + 3]) }, sourceUrl: `https://npb.jp/bis/eng/players/${id}.html` });
  }
  return result;
}

async function npbPlayers() {
  const teams = Object.values(NPB_TEAMS);
  return (await Promise.all(teams.map(npbTeamPlayers))).flat();
}

export async function loadLeaguePlayers(league: LeagueCode) {
  if (league === "kbo") return kboPlayers();
  if (league === "mlb") return mlbPlayers();
  return npbPlayers();
}

export async function loadPlayer(league: LeagueCode, id: string, role?: PlayerRole) {
  if (!/^\d+$/.test(id)) return null;
  const players = await loadLeaguePlayers(league);
  const matches = players.filter((player) => player.id === id && (!role || player.role === role));
  if (matches.length <= 1) return matches[0] ?? players.find((player) => player.id === id) ?? null;
  const pitcher = matches.find((player) => player.role === "투수");
  const hitter = matches.find((player) => player.role === "타자");
  if (!pitcher || !hitter) return matches[0];
  return {
    ...pitcher,
    role: "투수·타자" as const,
    games: Math.max(pitcher.games, hitter.games),
    stats: {
      ...Object.fromEntries(Object.entries(pitcher.stats).map(([key, value]) => [`투수 ${key}`, value])),
      ...Object.fromEntries(Object.entries(hitter.stats).map(([key, value]) => [`타자 ${key}`, value])),
    },
  };
}

export async function loadAllPlayers() {
  const [kbo, mlb, npb] = await Promise.all([kboPlayers(), mlbPlayers(), npbPlayers()]);
  return { kbo, mlb, npb, all: [...kbo, ...mlb, ...npb] };
}

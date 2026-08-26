type AnyRow = Record<string, any>;

const BLOGGER_API = "https://www.googleapis.com/blogger/v3";

function required(name: string) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} 환경변수가 필요합니다.`);
  return value;
}

export function bloggerConfigured() {
  return Boolean(
    process.env.BLOGGER_BLOG_ID &&
      process.env.BLOGGER_CLIENT_ID &&
      process.env.BLOGGER_CLIENT_SECRET &&
      process.env.BLOGGER_REFRESH_TOKEN,
  );
}

async function accessToken() {
  const body = new URLSearchParams({
    client_id: required("BLOGGER_CLIENT_ID"),
    client_secret: required("BLOGGER_CLIENT_SECRET"),
    refresh_token: required("BLOGGER_REFRESH_TOKEN"),
    grant_type: "refresh_token",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    throw new Error(`Google OAuth 갱신 실패: ${JSON.stringify(payload)}`);
  }
  return String(payload.access_token);
}

async function bloggerFetch(path: string, init: RequestInit = {}) {
  const token = await accessToken();
  const response = await fetch(`${BLOGGER_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json; charset=utf-8",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Blogger API 오류: ${response.status} ${JSON.stringify(payload)}`);
  return payload;
}

export async function findBloggerPost(title: string) {
  const blogId = required("BLOGGER_BLOG_ID");
  const params = new URLSearchParams({ q: title, fetchBodies: "false" });
  const payload = await bloggerFetch(`/blogs/${blogId}/posts/search?${params}`);
  return (payload?.items || []).find((item: AnyRow) => String(item.title || "").trim() === title.trim()) || null;
}

export async function publishBloggerPost(input: {
  title: string;
  content: string;
  labels?: string[];
}) {
  const duplicate = await findBloggerPost(input.title);
  const blogId = required("BLOGGER_BLOG_ID");
  if (duplicate) {
    const payload = await bloggerFetch(`/blogs/${blogId}/posts/${duplicate.id}`, {
      method: "PUT",
      body: JSON.stringify({ kind: "blogger#post", id: duplicate.id, blog: { id: blogId }, title: input.title, content: input.content, labels: input.labels || ["장군분석", "스포츠 분석"] }),
    });
    return { skipped: false, updated: true, id: payload.id, url: payload.url, title: payload.title };
  }
  const payload = await bloggerFetch(`/blogs/${blogId}/posts/`, {
    method: "POST",
    body: JSON.stringify({
      kind: "blogger#post",
      blog: { id: blogId },
      title: input.title,
      content: input.content,
      labels: input.labels || ["장군분석", "스포츠 분석"],
    }),
  });
  return { skipped: false, updated: false, id: payload.id, url: payload.url, title: payload.title };
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function rows(payload: any): AnyRow[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.games)) return payload.games;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function record(form: AnyRow | null | undefined) {
  if (!form) return "기록 확인 중";
  return `${form.win || 0}승 ${form.draw || 0}무 ${form.loss || 0}패 · ${form.gf || 0}득점 ${form.ga || 0}실점`;
}

function resultList(items: AnyRow[]) {
  if (!items?.length) return "<p>최근 경기 세부 결과를 확인 중입니다.</p>";
  return `<div style="display:grid;gap:6px">${items.slice(0, 10).map((row) => {
    const home = escapeHtml(row.homeTeam || row.home || "홈팀");
    const away = escapeHtml(row.awayTeam || row.away || row.opponent || "원정팀");
    const homeScore = escapeHtml(row.homeScore ?? "-");
    const awayScore = escapeHtml(row.awayScore ?? "-");
    return `<div style="padding:8px;border-bottom:1px solid #dfe7f0"><b>${escapeHtml(String(row.date || "").slice(5))}</b> ${home} ${homeScore} : ${awayScore} ${away}</div>`;
  }).join("")}</div>`;
}

function header(title: string, description: string) {
  return `<div style="background:#071426;color:#eef6ff;padding:24px;border-radius:18px;line-height:1.7"><div style="color:#42d6bd;font-weight:800">JANGGUN SPORTS ANALYSIS</div><h1 style="font-size:28px;margin:6px 0">${escapeHtml(title)}</h1><p style="color:#bdcce0">${escapeHtml(description)}</p></div>${cta()}`;
}

function cta() {
  return `<div style="background:#071426;color:#eef6ff;padding:18px 20px;border-radius:14px;margin:18px 0;border:1px solid #1f4d80"><b style="color:#42d6bd">장군분석 전체 데이터 보기</b><p>블로그 요약을 먼저 보고, 경기별 선발·최근 기록·홈원정 세부 데이터는 장군분석에서 이어서 확인하세요.</p><a href="https://www.장군분석.kr" target="_blank" rel="noopener" style="display:inline-block;background:#1167f1;color:#fff;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:800">장군분석 상세 분석 바로가기 →</a></div>`;
}

function koreanDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

function baseballAnalysisUrl(configKey: string, date: string, game: AnyRow) {
  const away = String(game.away || "원정팀").trim(), home = String(game.home || "홈팀").trim();
  const query = new URLSearchParams();
  const values: Record<string, unknown> = { league: configKey.toUpperCase(), date, gamePk: game.gamePk, time: game.time || game.startTime, away, home, awayTeamId: game.awayTeamId, homeTeamId: game.homeTeamId, stadium: game.stadium || game.venue, awayStarter: game.awayStarter || game.awayPitcher, homeStarter: game.homeStarter || game.homePitcher, awayStarterCode: game.awayStarterCode, homeStarterCode: game.homeStarterCode, awayApiName: game.awayApiName, homeApiName: game.homeApiName, commenceTime: game.commenceTime };
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== null && String(value).trim()) query.set(key, String(value));
  return `https://www.장군분석.kr/analysis/${configKey}/${encodeURIComponent(date)}/${encodeURIComponent(away)}-vs-${encodeURIComponent(home)}?${query.toString()}`;
}

export async function makeFootballPosts(origin: string, date: string) {
  const schedule = await fetch(`${origin}/api/football?date=${date}`, { cache: "no-store" }).then((r) => r.json());
  const grouped = new Map<string, AnyRow[]>();
  for (const game of rows(schedule)) {
    const key = String(game.leagueName || game.league || "축구");
    grouped.set(key, [...(grouped.get(key) || []), game]);
  }

  const posts: Array<{ title: string; content: string; labels: string[] }> = [];
  for (const [leagueName, games] of grouped) {
    const cards = await Promise.all(games.map(async (game) => {
      const params = new URLSearchParams({
        league: String(game.league || ""), date, gameId: String(game.id || ""),
        home: String(game.home || ""), away: String(game.away || ""),
        homeId: String(game.homeId || ""), awayId: String(game.awayId || ""),
      });
      const analysis = await fetch(`${origin}/api/football/analysis?${params}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
      const home = escapeHtml(game.home);
      const away = escapeHtml(game.away);
      const homeLogo = game.homeId ? `<img src="https://a.espncdn.com/i/teamlogos/soccer/500/${escapeHtml(game.homeId)}.png" alt="${home} 엠블럼" style="width:92px;height:92px;object-fit:contain">` : "";
      const awayLogo = game.awayId ? `<img src="https://a.espncdn.com/i/teamlogos/soccer/500/${escapeHtml(game.awayId)}.png" alt="${away} 엠블럼" style="width:92px;height:92px;object-fit:contain">` : "";
      const probability = analysis?.prediction?.probabilities;
      const h2h = analysis?.h2hStats;
      return `<section style="background:#fff;color:#17243a;border:1px solid #cfd9e7;border-radius:18px;padding:20px;margin:26px 0"><div style="display:grid;grid-template-columns:1fr 50px 1fr;align-items:center;background:linear-gradient(135deg,#071426,#102a4c);padding:20px;border-radius:16px;color:#fff;text-align:center"><div>${homeLogo}<h2 style="color:#fff">${home}</h2><small>홈팀</small></div><b>VS</b><div>${awayLogo}<h2 style="color:#fff">${away}</h2><small>원정팀</small></div></div><p style="color:#1268e8;font-weight:800">${escapeHtml(game.time)} · ${escapeHtml(game.venue)}</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div style="background:#eef5ff;padding:14px;border-radius:12px"><b>${home} 최근 경기</b><br>${record(analysis?.homeForm)}<br>홈 평균 ${analysis?.homeVenue?.avgFor ?? "-"}득점 · ${analysis?.homeVenue?.avgAgainst ?? "-"}실점</div><div style="background:#eef5ff;padding:14px;border-radius:12px"><b>${away} 최근 경기</b><br>${record(analysis?.awayForm)}<br>원정 평균 ${analysis?.awayVenue?.avgFor ?? "-"}득점 · ${analysis?.awayVenue?.avgAgainst ?? "-"}실점</div></div><h3>최근 10경기 전체 결과</h3><div style="display:grid;grid-template-columns:1fr 1fr;gap:14px"><div>${resultList(analysis?.homeRecent || [])}</div><div>${resultList(analysis?.awayRecent || [])}</div></div><h3>최근 맞대결</h3><p>${home} ${h2h?.homeWins ?? 0}승 · 무승부 ${h2h?.draws ?? 0} · ${away} ${h2h?.awayWins ?? 0}승</p>${resultList((analysis?.h2h || []).map((row: AnyRow) => ({ date: row.date, homeTeam: home, awayTeam: away, homeScore: String(row.score || "-").split("-")[0], awayScore: String(row.score || "-").split("-")[1] })))}<h3>승리 확률과 득점 흐름</h3><div style="background:#071426;color:#eef6ff;border-radius:12px;padding:16px;line-height:1.9"><b>승리만 계산:</b> ${home} ${probability?.home ?? "-"}% · 무승부 ${probability?.draw ?? "-"}% · ${away} ${probability?.away ?? "-"}%<br><b>총 3골 이상:</b> ${analysis?.prediction?.over25 ?? "-"}% · <b>양 팀 득점:</b> ${analysis?.prediction?.btts ?? "-"}%</div><h3>장군분석 해설</h3><p style="line-height:1.9">${escapeHtml((analysis?.narrative || []).slice(0, 4).join(" ") || `${home}과 ${away}의 최근 경기력, 홈원정 득실점과 맞대결을 함께 비교했습니다.`)}</p><div style="background:#e9fff7;border-left:6px solid #00a97f;padding:15px;border-radius:10px"><b>최종 판단:</b> ${escapeHtml(analysis?.lean || "경기 직전 라인업 확인 필요")}</div></section>`;
    }));
    const title = `${koreanDate(date)} ${leagueName} ${games.length}경기 상세 분석`;
    posts.push({ title, content: header(title, "최근 10경기·맞대결·홈원정·득점 흐름을 한눈에 비교합니다.") + cards.join("") + `<p style="font-size:13px;color:#748399">자동 수집 시각 ${new Date().toISOString()} · 경기 직전 라인업 변경은 장군분석에서 다시 확인하세요.</p>`, labels: ["축구", leagueName, "경기 분석"] });
  }
  return posts;
}

export async function makeBaseballPosts(origin: string, date: string) {
  const configs = [
    { key: "kbo", name: "KBO", endpoint: "/api/kbo" },
    { key: "mlb", name: "MLB", endpoint: "/api/mlb" },
    { key: "npb", name: "NPB", endpoint: "/api/npb" },
  ];
  const posts = [];
  for (const config of configs) {
    const payload = await fetch(`${origin}${config.endpoint}?date=${date}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    const confirmed = rows(payload).filter((game) => {
      const awayStarter = String(game.awayStarter || game.awayPitcher || "").trim();
      const homeStarter = String(game.homeStarter || game.homePitcher || "").trim();
      return awayStarter && homeStarter && !/미정|TBD|예정/i.test(`${awayStarter}${homeStarter}`);
    });
    if (!confirmed.length) continue;
    const title = `${koreanDate(date)} ${config.name} 확정 선발 ${confirmed.length}경기 상세 분석`;
    const cards = confirmed.map((game) => `<section style="background:#fff;color:#17243a;border:1px solid #cfd9e7;border-radius:16px;padding:20px;margin:20px 0"><div style="color:#1268e8;font-weight:800">${escapeHtml(game.time || game.startTime || "경기 시간 확인")}</div><h2>${escapeHtml(game.away)} vs ${escapeHtml(game.home)}</h2><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div style="background:#eef5ff;padding:14px;border-radius:12px"><b>${escapeHtml(game.away)} 선발</b><br>${escapeHtml(game.awayStarter || game.awayPitcher)}</div><div style="background:#eef5ff;padding:14px;border-radius:12px"><b>${escapeHtml(game.home)} 선발</b><br>${escapeHtml(game.homeStarter || game.homePitcher)}</div></div><p>선발투수의 시즌 성적과 상대전적, 최근 등판, 팀 타선과 불펜 소모를 함께 확인해야 합니다. 경기 직전 변경된 선발과 라인업은 아래 상세 분석에서 자동 갱신됩니다.</p><a href="${escapeHtml(baseballAnalysisUrl(config.key, date, game))}" target="_blank" rel="noopener" style="display:inline-block;background:#1167f1;color:#fff;text-decoration:none;padding:12px 18px;border-radius:9px;font-weight:800">이 경기 전체 데이터 보기 →</a></section>`).join("");
    posts.push({ title, content: header(title, "선발이 공식 발표된 경기만 자동 게시합니다.") + cards, labels: [config.name, "야구", "확정 선발"] });
  }
  return posts;
}

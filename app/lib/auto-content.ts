import { createHmac, randomUUID } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";
import { readSportsCache, writeSportsCache } from "@/app/lib/sports-db-cache";
import { saveApproval } from "@/app/lib/content-automation-store";
import { loadReelAnalysis, type ContentGame, type ContentLeague } from "@/app/lib/content-analysis";

const execFileAsync = promisify(execFile);

type Game = ContentGame & { gamePk?: number; id?: string | number; time?: string };

type AutoResult = { league: string; game: string; approvalId: string };

function kstDate() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function starter(game: Game, side: "away" | "home") {
  const values = side === "away" ? [game.awayStarter, game.awayStarterName, game.awayPitcher] : [game.homeStarter, game.homeStarterName, game.homePitcher];
  return values.find((v) => String(v || "").trim()) || "선발 미정";
}
function safe(value: unknown) { return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c)); }
function wrap(text: string, max = 18) {
  const chars = [...text]; const lines: string[] = []; let line = "";
  for (const ch of chars) { line += ch; if (line.length >= max) { lines.push(line); line = ""; } }
  if (line) lines.push(line); return lines.slice(0, 3);
}
function matchupLabel(value: string) {
  const wins = Number((String(value).match(/(\d+)\s*승/) || [])[1] || 0);
  const draws = Number((String(value).match(/(\d+)\s*무/) || [])[1] || 0);
  const losses = Number((String(value).match(/(\d+)\s*패/) || [])[1] || 0);
  return wins || draws || losses ? `${wins}승${draws ? ` ${draws}무` : ""} ${losses}패` : value;
}
function slideSvg(title: string, lines: string[], footer: string, isFirstSlide = false) {
  const text = lines.flatMap((line, i) => wrap(line).map((part, j) => `<text x="540" y="${700 + (i * 150) + (j * 72)}" text-anchor="middle" fill="#f8fafc" font-size="58" font-weight="700">${safe(part)}</text>`)).join("");
  const topBrand = isFirstSlide
    ? `<rect x="210" y="64" width="660" height="92" rx="46" fill="#f8fafc" stroke="#cbd5e1" stroke-width="4"/><circle cx="270" cy="110" r="17" fill="#16a34a"/><text x="540" y="127" text-anchor="middle" fill="#0f172a" font-size="48" font-weight="900">장군분석.kr</text>`
    : "";
  return `<svg width="1080" height="1920" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#07111f"/><stop offset="1" stop-color="#101827"/></linearGradient></defs><rect width="1080" height="1920" fill="url(#g)"/>${topBrand}<circle cx="540" cy="310" r="120" fill="#162b4d"/><text x="540" y="350" text-anchor="middle" font-size="110">⚾</text><text x="540" y="540" text-anchor="middle" fill="#60a5fa" font-size="66" font-weight="800">${safe(title)}</text>${text}<rect x="90" y="1710" width="900" height="2" fill="#334155"/><text x="540" y="1790" text-anchor="middle" fill="#94a3b8" font-size="34">${safe(footer)}</text><text x="540" y="1848" text-anchor="middle" fill="#f8fafc" font-size="34" font-weight="800">장군분석.kr</text></svg>`;
}
function sign(value: string, secret: string) { return createHmac("sha256", secret).update(value).digest("base64url"); }
function encode(value: object) { return Buffer.from(JSON.stringify(value), "utf8").toString("base64url"); }
async function telegramJson(token: string, method: string, body: object) {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json(); if (!r.ok || !j?.ok) throw new Error(j?.description || `Telegram ${method} 실패`); return j;
}
async function synthesize(text: string, out: string) {
  const key = process.env.GOOGLE_TTS_API_KEY; if (!key) return false;
  const r = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(key)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input: { text }, voice: { languageCode: "ko-KR", ssmlGender: "NEUTRAL" }, audioConfig: { audioEncoding: "MP3", speakingRate: 1.08 } }) });
  const j = await r.json(); if (!r.ok || !j?.audioContent) return false; await fs.writeFile(out, Buffer.from(j.audioContent, "base64")); return true;
}
async function mediaDuration(file: string) {
  if (!ffmpegPath) return 0;
  try {
    await execFileAsync(ffmpegPath, ["-i", file, "-f", "null", "-"], { timeout: 30000 });
    return 0;
  } catch (error) {
    const stderr = String((error as { stderr?: string })?.stderr || "");
    const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    return match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) : 0;
  }
}
async function renderVideo(game: Game, league: ContentLeague, date: string, siteUrl: string) {
  if (!ffmpegPath) throw new Error("ffmpeg 실행 파일을 찾지 못했습니다.");
  const away = game.away || "원정팀", home = game.home || "홈팀";
  const a = starter(game, "away"), h = starter(game, "home");
  const analysis = await loadReelAnalysis(siteUrl, league, game, date);
  const predicted = Number(analysis.homeWinRate) >= 50 ? home : away;
  const slides = [
    ["오늘 승부를 가를 3가지", [`${away} vs ${home}`, "선발 · 최근 흐름 · 맞대결"]],
    ["선발투수 비교", [`${away}: ${a} · ERA ${analysis.awayEra}`, `${home}: ${h} · ERA ${analysis.homeEra}`]],
    ["최근 10경기", [`${away}: ${analysis.awayRecent}`, `${home}: ${analysis.homeRecent}`]],
    ["최근 맞대결", [`${away}: ${matchupLabel(analysis.awayH2h)}`, `${home}: ${matchupLabel(analysis.homeH2h)}`]],
    ["AI 최종 예측", [`${predicted} 우세 · ${analysis.homeWinRate}%`, `예상 점수 ${analysis.awayScore} : ${analysis.homeScore}`]],
    ["전체 데이터 확인", [analysis.summary, "프로필 링크에서 무료 확인", "장군분석.kr"]],
  ];
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "sports-ai-auto-"));
  const narration = `${league} ${away} 대 ${home}, 오늘 승부를 가를 세 가지를 확인합니다. 원정 선발 ${a}, 평균자책점 ${analysis.awayEra}. 홈 선발 ${h}, 평균자책점 ${analysis.homeEra}. 최근 열 경기 흐름은 ${away} ${analysis.awayRecent}, ${home} ${analysis.homeRecent}. AI 분석 결과 ${predicted} 우세, 예상 점수 ${analysis.awayScore} 대 ${analysis.homeScore}입니다. 선발과 불펜, 최근 흐름 전체 데이터는 프로필 링크에서 확인하세요.`;
  const audio = path.join(dir, "voice.mp3"); const hasAudio = await synthesize(narration, audio);
  const voiceDuration = hasAudio ? await mediaDuration(audio) : 0;
  const perSlide = voiceDuration > 0 ? Math.max(1.5, (voiceDuration + 0.12) / slides.length) : 3;
  const concat: string[] = [];
  for (let i = 0; i < slides.length; i++) {
    const png = path.join(dir, `slide-${i}.png`);
    await sharp(Buffer.from(slideSvg(slides[i][0] as string, slides[i][1] as string[], `${away} vs ${home}`, i === 0))).png().toFile(png);
    concat.push(`file '${png.replaceAll("'", "'\\''")}'`, `duration ${perSlide.toFixed(3)}`);
  }
  concat.push(`file '${path.join(dir, `slide-${slides.length - 1}.png`).replaceAll("'", "'\\''")}'`);
  const list = path.join(dir, "slides.txt"); await fs.writeFile(list, concat.join("\n"));
  const output = path.join(dir, "sports-ai-auto.mp4");
  const args = ["-y", "-f", "concat", "-safe", "0", "-i", list];
  if (hasAudio) {
    args.push("-i", audio, "-f", "lavfi", "-i", `aevalsrc=0.025*(sin(2*PI*110*t)+0.45*sin(2*PI*164.81*t)+0.3*sin(2*PI*220*t)):s=48000:d=${Math.max(voiceDuration, 18).toFixed(2)}`);
    const musicFadeAt = Math.max(1, voiceDuration - 2).toFixed(2);
    args.push("-filter_complex", `[1:a]volume=1.0[voice];[2:a]volume=0.30,afade=t=in:st=0:d=0.8,afade=t=out:st=${musicFadeAt}:d=2[music];[voice][music]amix=inputs=2:duration=first:dropout_transition=0[aout]`, "-map", "0:v:0", "-map", "[aout]", "-shortest");
  } else {
    args.push("-f", "lavfi", "-i", `aevalsrc=0.025*(sin(2*PI*110*t)+0.45*sin(2*PI*164.81*t)+0.3*sin(2*PI*220*t)):s=48000:d=${(slides.length * perSlide).toFixed(2)}`, "-map", "0:v:0", "-map", "1:a:0", "-shortest");
  }
  args.push("-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-maxrate", "10M", "-bufsize", "20M");
  args.push("-c:a", "aac", "-b:a", "192k");
  args.push("-movflags", "+faststart", output);
  await execFileAsync(ffmpegPath, args, { timeout: 240000, maxBuffer: 1024 * 1024 * 8 });
  return { dir, output, narration };
}
async function fetchGames(siteUrl: string, league: string, date: string): Promise<Game[]> {
  const r = await fetch(`${siteUrl}/api/${league.toLowerCase()}?date=${encodeURIComponent(date)}`, { cache: "no-store" });
  const j = await r.json(); if (!r.ok || !j?.success) return []; return Array.isArray(j.games) ? j.games : [];
}
export async function runAutomaticContent(siteUrl: string): Promise<AutoResult[]> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN, chatId = process.env.TELEGRAM_CHAT_ID;
  const secret = process.env.CONTENT_APPROVAL_SECRET || botToken;
  if (!botToken || !chatId || !secret) throw new Error("텔레그램 자동화 환경변수가 없습니다.");
  const date = kstDate(); const max = Math.max(1, Math.min(3, Number(process.env.AUTO_CONTENT_MAX_PER_RUN || 1)));
  const results: AutoResult[] = [];
  for (const league of ["KBO", "NPB", "MLB"]) {
    const games = await fetchGames(siteUrl, league, date);
    for (const game of games) {
      if (results.length >= max) return results;
      const gameKey = String(game.gamePk || game.id || `${game.away}-${game.home}-${game.time || ""}`);
      const dedup = `auto-content-sent:${date}:${league}:${gameKey}`;
      if (await readSportsCache(dedup)) continue;
      const { dir, output, narration } = await renderVideo(game, league as ContentLeague, date, siteUrl);
      try {
        const buffer = await fs.readFile(output); const approvalId = randomUUID();
        const title = `${game.away || "원정팀"} vs ${game.home || "홈팀"}`;
        const caption = `⚾ ${league} ${title}\n\n오늘 승부를 가를 핵심 변수는 무엇일까요?\n${narration}\n\n선발·불펜·최근 흐름 전체 데이터는 프로필 링크에서 무료로 확인하세요.\n여러분은 어느 팀을 주목하시나요? 댓글로 남겨주세요.\n\n#${league} #야구 #야구분석 #장군분석`;
        const platforms = ["youtube", "instagram", "tiktok"];
        const payload = encode({ approvalId, league, date, away: game.away, home: game.home, title, platforms, exp: Date.now() + 24 * 60 * 60 * 1000 });
        const token = `${payload}.${sign(payload, secret)}`;
        const approveUrl = `${siteUrl}/api/content/telegram/action?action=approve&token=${encodeURIComponent(token)}`;
        const cancelUrl = `${siteUrl}/api/content/telegram/action?action=cancel&token=${encodeURIComponent(token)}`;
        const form = new FormData(); form.set("chat_id", chatId); form.set("document", new Blob([new Uint8Array(buffer)], { type: "video/mp4" }), "sports-ai-auto.mp4"); form.set("caption", `🤖 자동 생성 릴스\n${league} ${title}\n\n영상을 확인한 뒤 발행 여부를 선택하세요.`);
        const vr = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, { method: "POST", body: form }); const vj = await vr.json();
        if (!vr.ok || !vj?.ok) throw new Error(vj?.description || "자동 릴스 텔레그램 전송 실패");
        const fileId = vj?.result?.document?.file_id; if (!fileId) throw new Error("Telegram file_id 없음");
        const now = new Date().toISOString();
        await saveApproval({ approvalId, league, date, away: game.away || "원정팀", home: game.home || "홈팀", title, description: caption, hashtags: caption.split(/\s+/).filter((x) => x.startsWith("#")).join(" "), platforms, privacyStatus: "public", status: "waiting", telegramFileId: fileId, fileName: "sports-ai-auto.mp4", mimeType: "video/mp4", createdAt: now, updatedAt: now });
        await telegramJson(botToken, "sendMessage", { chat_id: chatId, text: `✅ 자동 릴스 준비 완료\n${league} ${title}`, reply_markup: { inline_keyboard: [[{ text: "✅ 발행 승인", url: approveUrl }, { text: "❌ 취소", url: cancelUrl }], [{ text: "✏️ 내용 수정", url: `${siteUrl}/content` }]] } });
        await writeSportsCache(dedup, { approvalId, sentAt: now }, 60 * 60 * 24 * 14);
        results.push({ league, game: title, approvalId });
      } finally { await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined); }
    }
  }
  return results;
}

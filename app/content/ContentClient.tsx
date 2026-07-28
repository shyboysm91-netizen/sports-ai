"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type League = "KBO" | "MLB" | "NPB";
type Game = {
  league?: League;
  gamePk?: number;
  id?: string | number;
  date?: string;
  time?: string;
  away?: string;
  home?: string;
  awayStarter?: string;
  homeStarter?: string;
  awayStarterName?: string;
  homeStarterName?: string;
  awayPitcher?: string;
  homePitcher?: string;
  awayStarterCode?: string;
  homeStarterCode?: string;
  awayTeamId?: number;
  homeTeamId?: number;
  awayStarterId?: number;
  homeStarterId?: number;
};

type ContentData = {
  league: League;
  date: string;
  away: string;
  home: string;
  awayStarter: string;
  homeStarter: string;
  awayEra: string;
  homeEra: string;
  awayRecent: string;
  homeRecent: string;
  awayH2h: string;
  homeH2h: string;
  awayScore: string;
  homeScore: string;
  homeWinRate: string;
  summary: string;
};

const blank = (league: League, date: string): ContentData => ({
  league, date, away: "", home: "", awayStarter: "선발 미정", homeStarter: "선발 미정",
  awayEra: "-", homeEra: "-", awayRecent: "-", homeRecent: "-", awayH2h: "-", homeH2h: "-",
  awayScore: "-", homeScore: "-", homeWinRate: "-", summary: "분석 페이지의 상세값을 확인해 필요한 항목만 수정하세요.",
});

function koreaDate(offsetDays = 0) {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + offsetDays);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function pickStarter(game: Game, side: "away" | "home") {
  const values = side === "away"
    ? [game.awayStarter, game.awayStarterName, game.awayPitcher]
    : [game.homeStarter, game.homeStarterName, game.homePitcher];
  return values.find((v) => String(v || "").trim()) || "선발 미정";
}

function hook(data: ContentData) {
  const rate = Number(data.homeWinRate);
  if (Number.isFinite(rate) && rate >= 80) return "AI가 가장 강하게 선택한 단 한 경기";
  if (Number.isFinite(rate) && rate >= 70) return `AI가 승률 ${rate}%를 준 오늘의 핵심 경기`;
  return `${data.away} vs ${data.home}, 오늘의 핵심 분석`;
}

const labels = ["오늘의 핵심 경기", "선발투수 비교", "최근 10경기", "맞대결", "AI 최종 예측", "전체 분석 확인"];

export default function ContentPage() {
  const [ownerReady, setOwnerReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [lockMessage, setLockMessage] = useState("");
  const search = useSearchParams();
  const initialLeague = ((search.get("league") || "KBO").toUpperCase() as League);
  const initialDate = search.get("date") || koreaDate();
  const [league, setLeague] = useState<League>(initialLeague);
  const [date, setDate] = useState(initialDate);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("오늘 경기를 불러온 뒤 경기 하나를 선택하세요.");
  const [active, setActive] = useState(0);
  const [data, setData] = useState<ContentData>(() => ({
    ...blank(initialLeague, initialDate),
    away: search.get("away") || "",
    home: search.get("home") || "",
    awayStarter: search.get("awayStarter") || "선발 미정",
    homeStarter: search.get("homeStarter") || "선발 미정",
  }));
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [caption, setCaption] = useState("");
  const [automationMessage, setAutomationMessage] = useState("콘텐츠 정보를 입력하면 캡션과 릴스를 자동으로 만들 수 있습니다.");
  const [makingReel, setMakingReel] = useState(false);
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [platforms, setPlatforms] = useState({ instagram: true, youtube: true, tiktok: true });
  const [connection, setConnection] = useState({ telegram: false, instagram: false, youtube: false, tiktok: false });
  const [youtubeConfigured, setYoutubeConfigured] = useState(false);
  const [youtubeFile, setYoutubeFile] = useState<File | null>(null);
  const [youtubePrivacy, setYoutubePrivacy] = useState("public");
  const [youtubeUploading, setYoutubeUploading] = useState(false);
  const [youtubeProgress, setYoutubeProgress] = useState(0);
  const [reelBlob, setReelBlob] = useState<Blob | null>(null);
  const [reelUrl, setReelUrl] = useState("");
  const [reelProgress, setReelProgress] = useState(0);
  const [bgmFile, setBgmFile] = useState<File | null>(null);
  const [slideSeconds, setSlideSeconds] = useState(2.4);
  const [speaking, setSpeaking] = useState(false);
  const [narrationText, setNarrationText] = useState("");
  const [reelOptions, setReelOptions] = useState({ bgm: false, subtitles: true, zoom: true, transition: true });

  useEffect(() => {
    setUnlocked(sessionStorage.getItem("sports-ai-owner") === "ok");
    setOwnerReady(true);
    fetch("/api/content/status", { cache: "no-store" })
      .then((response) => response.json())
      .then((json) => {
        setConnection({
          telegram: Boolean(json.telegram), instagram: Boolean(json.instagram),
          youtube: Boolean(json.youtube), tiktok: Boolean(json.tiktok),
        });
        setYoutubeConfigured(Boolean(json.youtubeConfigured));
      })
      .catch(() => undefined);
  }, []);

  function unlockOwner() {
    if (password === "2580") {
      sessionStorage.setItem("sports-ai-owner", "ok");
      setUnlocked(true);
      setPassword("");
      setLockMessage("");
      return;
    }
    setLockMessage("비밀번호가 다릅니다.");
  }

  async function loadGames() {
    setLoading(true); setMessage("경기 일정을 불러오는 중입니다.");
    try {
      const response = await fetch(`/api/${league.toLowerCase()}?date=${encodeURIComponent(date)}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json?.success) throw new Error(json?.message || "경기를 불러오지 못했습니다.");
      const list = Array.isArray(json.games) ? json.games : [];
      setGames(list); setMessage(`${list.length}경기를 불러왔습니다. 경기 하나를 누르세요.`);
    } catch (error) {
      setGames([]); setMessage(error instanceof Error ? error.message : "경기를 불러오지 못했습니다.");
    } finally { setLoading(false); }
  }

  async function selectGame(game: Game) {
    const selectedDate = game.date || date;
    const selectedAway = game.away || "원정팀";
    const selectedHome = game.home || "홈팀";
    setData((prev) => ({
      ...prev, league, date: selectedDate, away: selectedAway, home: selectedHome,
      awayStarter: pickStarter(game, "away"), homeStarter: pickStarter(game, "home"),
      awayEra: "불러오는 중", homeEra: "불러오는 중",
    }));
    setMessage(`${selectedAway} vs ${selectedHome} 실제 분석 데이터를 불러오는 중입니다.`);

    try {
      const response = await fetch("/api/content/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ league, date: selectedDate, game }),
        cache: "no-store",
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json?.success || !json?.analysis) {
        throw new Error(json?.message || "실제 분석 데이터를 불러오지 못했습니다.");
      }
      setData((prev) => ({ ...prev, ...json.analysis,
        league, date: selectedDate, away: selectedAway, home: selectedHome,
        awayStarter: pickStarter(game, "away"), homeStarter: pickStarter(game, "home"),
      }));
      setMessage(`${selectedAway} vs ${selectedHome} 선발 ERA와 실제 분석 데이터를 불러왔습니다.`);
    } catch (error) {
      setData((prev) => ({ ...prev, awayEra: "기록 없음", homeEra: "기록 없음" }));
      setMessage(error instanceof Error ? error.message : "실제 분석 데이터를 불러오지 못했습니다.");
    }
  }

  const headline = useMemo(() => hook(data), [data]);

  useEffect(() => {
    setNarrationText(buildNarration(data, headline).join("\n"));
  }, [data, headline]);

  useEffect(() => () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    if (reelUrl) URL.revokeObjectURL(reelUrl);
  }, [reelUrl]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    drawCard(ctx, active, data, headline);
  }, [active, data, headline]);

  function update(key: keyof ContentData, value: string) { setData((prev) => ({ ...prev, [key]: value })); }

  function downloadCard(index: number) {
    const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = 1350;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    drawCard(ctx, index, data, headline);
    const link = document.createElement("a"); link.download = `sports-ai-${data.league}-${index + 1}.png`; link.href = canvas.toDataURL("image/png"); link.click();
  }

  async function downloadAll() {
    for (let i = 0; i < 6; i += 1) { downloadCard(i); await new Promise((r) => setTimeout(r, 350)); }
  }

  function makeCaption() {
    const winner = Number(data.homeWinRate) >= 50 ? data.home : data.away;
    const text = [
      `⚾ ${data.league} ${data.away} vs ${data.home}`,
      "",
      `장군 AI 예상: ${winner} 우세`,
      `예상 스코어: ${data.awayScore} : ${data.homeScore}`,
      `홈 승리 확률: ${data.homeWinRate}%`,
      "",
      data.summary,
      "",
      "전체 분석은 장군 AI에서 확인하세요.",
      `#야구 #${data.league} #야구분석 #스포츠AI #경기예측 #${data.away.replaceAll(" ", "")} #${data.home.replaceAll(" ", "")}`,
    ].join("\n");
    setCaption(text);
    setAutomationMessage("플랫폼 공용 캡션을 만들었습니다.");
  }

  async function makeReel() {
    if (makingReel) return;
    if (typeof MediaRecorder === "undefined") {
      setAutomationMessage("현재 브라우저는 영상 생성을 지원하지 않습니다. 최신 Chrome을 사용하세요.");
      return;
    }
    setMakingReel(true);
    setReelProgress(0);
    setAutomationMessage("9:16 릴스를 만드는 중입니다.");
    let audioContext: AudioContext | null = null;
    let objectUrls: string[] = [];
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1080; canvas.height = 1920;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("영상 캔버스를 만들지 못했습니다.");

      const videoStream = canvas.captureStream(30);
      const combined = new MediaStream(videoStream.getVideoTracks());
      audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();
      let hasAudio = false;

      const narration = narrationText.split("\n").map((line) => line.trim()).filter(Boolean);
      while (narration.length < 6) narration.push(buildNarration(data, headline)[narration.length] || "장군 AI 분석");
      const audioSources: AudioBufferSourceNode[] = [];
      const totalDuration = 6 * slideSeconds;

      if (reelOptions.bgm && bgmFile) {
        const buffer = await audioContext.decodeAudioData(await bgmFile.arrayBuffer());
        const source = audioContext.createBufferSource();
        const gain = audioContext.createGain();
        gain.gain.value = 0.22;
        source.buffer = buffer; source.loop = true;
        source.connect(gain).connect(destination); source.start();
        audioSources.push(source); hasAudio = true;
      }


      if (hasAudio) destination.stream.getAudioTracks().forEach((track) => combined.addTrack(track));
      const mimeCandidates = [
        "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
        "video/mp4;codecs=avc1,mp4a.40.2",
        "video/mp4",
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ];
      const mimeType = mimeCandidates.find((value) => MediaRecorder.isTypeSupported(value)) || "video/webm";
      const recorder = new MediaRecorder(combined, { mimeType, videoBitsPerSecond: 1_400_000, audioBitsPerSecond: 96_000 });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      const finished = new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
        recorder.onerror = () => reject(new Error("릴스 영상 생성에 실패했습니다."));
      });
      recorder.start(500);

      const slide = document.createElement("canvas"); slide.width = 1080; slide.height = 1350;
      const slideCtx = slide.getContext("2d");
      if (!slideCtx) throw new Error("카드 이미지를 만들지 못했습니다.");
      const perSlide = totalDuration / 6;
      const fullStarted = performance.now();
      for (let index = 0; index < 6; index += 1) {
        drawCard(slideCtx, index, data, headline);
        const started = performance.now();
        const slideMs = perSlide * 1000;
        while (performance.now() - started < slideMs) {
          const elapsed = performance.now() - started;
          const t = Math.min(1, elapsed / slideMs);
          ctx.fillStyle = "#070b12"; ctx.fillRect(0, 0, 1080, 1920);
          const scale = reelOptions.zoom ? 1 + t * 0.045 : 1;
          const dw = 1080 * scale, dh = 1350 * scale;
          ctx.save();
          if (reelOptions.transition) {
            const fade = Math.min(1, elapsed / 260, (slideMs - elapsed) / 260);
            ctx.globalAlpha = Math.max(0.06, fade);
          }
          ctx.drawImage(slide, (1080 - dw) / 2, 285 + (1350 - dh) / 2, dw, dh);
          ctx.restore();
          ctx.fillStyle = "#ffffff"; ctx.textAlign = "center"; ctx.font = "900 36px Arial";
          ctx.fillText(`${data.away} vs ${data.home}`, 540, 160);
          if (reelOptions.subtitles) drawSubtitle(ctx, narration[index], 540, 1650);
          ctx.fillStyle = "#4d9cff"; ctx.font = "800 28px Arial";
          ctx.fillText(`SPORTS AI · ${index + 1}/6`, 540, 1800);
          const progressed = Math.min(99, Math.round(((performance.now() - fullStarted) / (totalDuration * 1000)) * 100));
          setReelProgress(progressed);
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
      }
      recorder.stop();
      const blob = await finished;
      audioSources.forEach((source) => { try { source.stop(); } catch {} });
      if (reelUrl) URL.revokeObjectURL(reelUrl);
      const url = URL.createObjectURL(blob); objectUrls.push(url);
      setReelBlob(blob); setReelUrl(url); setReelProgress(100);
      const reelExtension = (blob.type || mimeType).includes("mp4") ? "mp4" : "webm";
      setYoutubeFile(new File([blob], `sports-ai-${data.league}-${data.away}-${data.home}-reels.${reelExtension}`, { type: blob.type || mimeType }));
      setAutomationMessage(reelExtension === "mp4" ? "릴스 생성 완료. YouTube와 Instagram 자동 업로드에 사용할 수 있습니다." : "릴스 생성 완료. 현재 브라우저는 WebM만 지원하므로 YouTube 업로드는 가능하지만 Instagram은 MP4 생성이 가능한 최신 Chrome에서 다시 생성해야 합니다.");
      objectUrls = [];
    } catch (error) {
      setAutomationMessage(error instanceof Error ? error.message : "릴스 영상 생성에 실패했습니다.");
    } finally {
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      if (audioContext) await audioContext.close().catch(() => undefined);
      setMakingReel(false);
    }
  }

  function saveReel() {
    if (!reelBlob || !reelUrl) return;
    const link = document.createElement("a");
    link.href = reelUrl;
    const reelExtension = reelBlob.type.includes("mp4") ? "mp4" : "webm";
    link.download = `sports-ai-${data.league}-${data.away}-${data.home}-reels.${reelExtension}`;
    link.click();
  }


  function previewNarration() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setAutomationMessage("이 브라우저에서는 무료 음성 미리듣기를 지원하지 않습니다. 최신 Chrome을 사용하세요.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(narrationText.replaceAll("\n", " "));
    utterance.lang = "ko-KR";
    utterance.rate = 1.03;
    utterance.pitch = 1;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => { setSpeaking(false); setAutomationMessage("음성 미리듣기에 실패했습니다."); };
    window.speechSynthesis.speak(utterance);
    setAutomationMessage("무료 브라우저 음성으로 대본을 미리듣는 중입니다. 이 음성은 영상 파일에는 포함되지 않습니다.");
  }

  function stopNarration() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  async function uploadYoutube() {
    if (!youtubeFile || youtubeUploading) return;
    setYoutubeUploading(true); setYoutubeProgress(0); setAutomationMessage("유튜브 업로드 준비 중입니다.");
    try {
      const response = await fetch("/api/content/youtube/upload-session", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ title:`${data.away} vs ${data.home} 장군 AI 분석`, description:caption || data.summary, privacyStatus:youtubePrivacy, mimeType:youtubeFile.type || "video/webm", size:youtubeFile.size }) });
      const json = await response.json();
      if (!response.ok || !json.uploadUrl) throw new Error(json.message || "업로드 세션 생성 실패");
      await new Promise<void>((resolve,reject)=>{
        const xhr=new XMLHttpRequest(); xhr.open("PUT",json.uploadUrl); xhr.setRequestHeader("Content-Type",youtubeFile.type || "video/webm");
        xhr.upload.onprogress=(e)=>{ if(e.lengthComputable) setYoutubeProgress(Math.round((e.loaded/e.total)*100)); };
        xhr.onload=()=> xhr.status>=200&&xhr.status<300 ? resolve() : reject(new Error(`유튜브 업로드 실패 (${xhr.status})`));
        xhr.onerror=()=>reject(new Error("유튜브 업로드 중 네트워크 오류가 발생했습니다.")); xhr.send(youtubeFile);
      });
      setAutomationMessage("유튜브 쇼츠 업로드가 완료되었습니다. 유튜브 스튜디오에서 공개 상태를 확인하세요."); setYoutubeProgress(100);
    } catch(error) { setAutomationMessage(error instanceof Error ? error.message : "유튜브 업로드 실패"); }
    finally { setYoutubeUploading(false); }
  }

  async function sendTelegram() {
    if (!reelBlob) {
      setAutomationMessage("릴스를 먼저 생성한 뒤 승인 요청을 보내세요.");
      return;
    }
    const telegramUploadLimit = 4 * 1024 * 1024;
    if (reelBlob.size > telegramUploadLimit) {
      setAutomationMessage(`현재 릴스 용량이 ${(reelBlob.size / 1024 / 1024).toFixed(1)}MB라 서버 전송 한도를 넘습니다. 새 버전에서 릴스를 다시 생성한 뒤 보내세요.`);
      return;
    }
    setSendingTelegram(true); setAutomationMessage("텔레그램으로 릴스와 승인 요청을 보내는 중입니다.");
    try {
      const chosen = Object.entries(platforms).filter(([, value]) => value).map(([key]) => key).join(",");
      const params = new URLSearchParams({ league: data.league, date: data.date, away: data.away, home: data.home, platforms: chosen });
      const payload = {
        ...data, caption: caption || data.summary,
        title: `${data.away} vs ${data.home}`,
        publishUrl: `${window.location.origin}/content?${params.toString()}`,
        platforms: chosen,
        privacyStatus: youtubePrivacy,
      };
      const form = new FormData();
      form.set("payload", JSON.stringify(payload));
      if (reelBlob) {
        const reelExtension = reelBlob.type.includes("mp4") ? "mp4" : "webm";
        form.set("media", new File([reelBlob], `sports-ai-${data.league}-${data.away}-vs-${data.home}.${reelExtension}`, { type: reelBlob.type || (reelExtension === "mp4" ? "video/mp4" : "video/webm") }));
      }
      const response = await fetch("/api/content/telegram", { method: "POST", body: form });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.message || "전송 실패");
      setAutomationMessage(json.message);
    } catch (error) { setAutomationMessage(error instanceof Error ? error.message : "텔레그램 전송 실패"); }
    finally { setSendingTelegram(false); }
  }

  const fields: Array<[keyof ContentData, string]> = [
    ["awayStarter", "원정 선발"], ["homeStarter", "홈 선발"], ["awayEra", "원정 ERA"], ["homeEra", "홈 ERA"],
    ["awayRecent", "원정 최근 10경기"], ["homeRecent", "홈 최근 10경기"], ["awayH2h", "원정 맞대결"], ["homeH2h", "홈 맞대결"],
    ["awayScore", "원정 예상 점수"], ["homeScore", "홈 예상 점수"], ["homeWinRate", "홈 승리확률"], ["summary", "한줄 분석"],
  ];

  if (!ownerReady) {
    return <main className="min-h-screen bg-slate-950 p-10 text-white">관리자 확인 중...</main>;
  }

  if (!unlocked) {
    return (
      <main className="min-h-screen bg-slate-950 px-5 py-20 text-white">
        <div className="mx-auto max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-7">
          <p className="text-sm font-black text-blue-400">OWNER ONLY</p>
          <h1 className="mt-3 text-3xl font-black">콘텐츠 제작 관리자</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">카드뉴스와 릴스 제작 화면은 관리자만 사용할 수 있습니다.</p>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") unlockOwner(); }}
            placeholder="관리자 비밀번호"
            autoFocus
            className="mt-6 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none"
          />
          <button type="button" onClick={unlockOwner} className="mt-3 w-full rounded-xl bg-blue-600 py-3 font-black">확인</button>
          {lockMessage && <p className="mt-3 text-sm text-red-300">{lockMessage}</p>}
          <Link href="/" className="mt-5 block text-center text-sm font-bold text-slate-400">← 홈으로</Link>
        </div>
      </main>
    );
  }

  return <main className="min-h-screen bg-slate-950 text-white">
    <header className="border-b border-slate-800 bg-slate-950">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
        <div><Link href="/" className="text-2xl font-black">장군 AI</Link><p className="mt-1 text-xs font-bold text-blue-400">콘텐츠 제작</p></div>
        <div className="flex items-center gap-2">
          <Link href="/" className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-black">← 경기 분석</Link>
          <button type="button" onClick={() => { sessionStorage.removeItem("sports-ai-owner"); setUnlocked(false); }} className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-black text-slate-400">잠금</button>
        </div>
      </div>
    </header>

    <section className="mx-auto grid max-w-7xl gap-6 px-5 py-8 lg:grid-cols-[430px_1fr]">
      <aside className="space-y-5">
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
          <h1 className="text-xl font-black">실제 경기 자동 불러오기</h1>
          <div className="mt-4 grid grid-cols-[110px_1fr] gap-2">
            <select value={league} onChange={(e) => setLeague(e.target.value as League)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 font-bold">
              <option>KBO</option><option>MLB</option><option>NPB</option>
            </select>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-3" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDate(koreaDate())}
              className={`rounded-xl border px-4 py-3 font-black ${date === koreaDate() ? "border-blue-500 bg-blue-600" : "border-slate-700 bg-slate-950"}`}
            >
              오늘 경기
            </button>
            <button
              type="button"
              onClick={() => setDate(koreaDate(1))}
              className={`rounded-xl border px-4 py-3 font-black ${date === koreaDate(1) ? "border-blue-500 bg-blue-600" : "border-slate-700 bg-slate-950"}`}
            >
              내일 경기
            </button>
          </div>
          <button onClick={loadGames} disabled={loading} className="mt-3 w-full rounded-xl bg-blue-600 px-4 py-3 font-black disabled:opacity-50">{loading ? "불러오는 중..." : "선택 날짜 경기 불러오기"}</button>
          <p className="mt-3 text-xs leading-5 text-slate-400">{message}</p>
          {games.length > 0 && <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">{games.map((g, i) => <button key={`${g.gamePk || i}-${g.away}-${g.home}`} onClick={() => selectGame(g)} className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-left hover:border-blue-500"><b>{g.away} vs {g.home}</b><p className="mt-1 text-xs text-slate-500">{pickStarter(g,"away")} · {pickStarter(g,"home")}</p></button>)}</div>}
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="font-black">선택 경기 정보</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label><span className="text-xs text-slate-500">원정팀</span><input value={data.away} onChange={(e)=>update("away",e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" /></label>
            <label><span className="text-xs text-slate-500">홈팀</span><input value={data.home} onChange={(e)=>update("home",e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" /></label>
            {fields.map(([key,label]) => <label key={key} className={key === "summary" ? "col-span-2" : ""}><span className="text-xs text-slate-500">{label}</span><input value={data[key]} onChange={(e)=>update(key,e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" /></label>)}
          </div>
        </div>
      </aside>

      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex gap-2 overflow-x-auto pb-3">{labels.map((label,i)=><button key={label} onClick={()=>setActive(i)} className={`whitespace-nowrap rounded-xl px-4 py-3 text-sm font-black ${active===i?"bg-blue-600":"border border-slate-700 bg-slate-950"}`}>{i+1}. {label}</button>)}</div>
        <div className="mt-3 flex justify-center rounded-2xl bg-slate-800 p-4"><canvas ref={canvasRef} width={1080} height={1350} className="h-auto w-full max-w-[480px] rounded-xl" /></div>
        <div className="mt-4 grid grid-cols-2 gap-3"><button onClick={()=>downloadCard(active)} className="rounded-xl border border-slate-700 px-4 py-3 font-black">현재 장 PNG 저장</button><button onClick={downloadAll} className="rounded-xl bg-blue-600 px-4 py-3 font-black">6장 전체 PNG 저장</button></div>

        <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950 p-5">
          <h2 className="text-lg font-black">릴스·쇼츠 자동화</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">캐러셀 6장을 세로 영상으로 만들고 자막·전환·확대·배경음악을 적용합니다. 카드 등록이나 외부 음성 API 없이 바로 사용할 수 있습니다.</p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {([['subtitles','자동 자막'],['zoom','확대 효과'],['transition','전환 효과'],['bgm','배경음악']] as const).map(([key,label]) => <label key={key} className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 p-3 text-sm font-bold"><input type="checkbox" checked={reelOptions[key]} onChange={(e)=>setReelOptions((prev)=>({...prev,[key]:e.target.checked}))}/>{label}</label>)}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[180px_1fr]">
            <label className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm font-bold">장면 길이
              <select value={slideSeconds} onChange={(e)=>setSlideSeconds(Number(e.target.value))} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-2">
                <option value={1.8}>빠르게 · 약 11초</option><option value={2.4}>기본 · 약 15초</option><option value={3}>천천히 · 약 18초</option>
              </select>
            </label>
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-3">
              <div className="flex items-center justify-between gap-2"><b className="text-sm">릴스 대본</b><div className="flex gap-2"><button type="button" onClick={previewNarration} className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-black">{speaking?"다시 듣기":"무료 음성 미리듣기"}</button>{speaking&&<button type="button" onClick={stopNarration} className="rounded-lg border border-red-800 px-3 py-2 text-xs font-black text-red-300">정지</button>}</div></div>
              <textarea value={narrationText} onChange={(e)=>setNarrationText(e.target.value)} className="mt-2 min-h-32 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm leading-6" />
              <p className="mt-2 text-xs text-slate-500">줄마다 한 장면의 자막으로 사용됩니다. 무료 음성은 대본 확인용이며 영상에는 자막과 선택한 배경음악이 들어갑니다.</p>
            </div>
          </div>
          {reelOptions.bgm && <div className="mt-3"><input type="file" accept="audio/*" onChange={(e)=>setBgmFile(e.target.files?.[0]||null)} className="block w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm"/><p className="mt-1 text-xs text-slate-500">직접 보유하거나 사용 권한이 있는 음악 파일만 선택하세요.</p></div>}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={makeCaption} className="rounded-xl border border-slate-700 px-4 py-3 font-black">캡션 자동 생성</button>
            <button type="button" onClick={makeReel} disabled={makingReel} className="rounded-xl bg-violet-600 px-4 py-3 font-black disabled:opacity-50">{makingReel ? `릴스 생성 중 ${reelProgress}%` : "9:16 릴스 만들기"}</button>
          </div>
          {makingReel && <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-violet-500" style={{width:`${reelProgress}%`}} /></div>}
          {reelUrl && <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-900 p-4"><video src={reelUrl} controls playsInline className="pointer-events-none mx-auto max-h-[620px] w-full max-w-sm rounded-xl bg-black"/><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={saveReel} className="rounded-xl bg-emerald-600 px-4 py-3 font-black">영상 저장</button><button type="button" onPointerDown={(event)=>{event.stopPropagation();}} onClick={(event)=>{event.preventDefault(); event.stopPropagation(); try { if (reelBlob) { const ext = reelBlob.type.includes("mp4") ? "mp4" : "webm"; const file = new File([reelBlob], `sports-ai-${data.league}-${data.away}-vs-${data.home}.${ext}`, {type: reelBlob.type || (ext === "mp4" ? "video/mp4" : "video/webm")}); setYoutubeFile(file); setAutomationMessage(`유튜브 업로드 파일 연결 완료: ${file.name}`); } else { setAutomationMessage("버튼 클릭 확인: 릴스 파일 상태가 없습니다."); } } catch(error) { setAutomationMessage("유튜브 연결 오류가 발생했습니다."); } }} className="relative z-50 cursor-pointer rounded-xl border border-slate-700 px-4 py-3 font-black">유튜브에 사용</button></div></div>}
          <textarea value={caption} onChange={(event)=>setCaption(event.target.value)} placeholder="캡션 자동 생성 버튼을 누르세요." className="mt-3 min-h-52 w-full rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm leading-6 outline-none" />
          <div className="mt-4 grid grid-cols-3 gap-2 text-sm font-bold">
            {([['instagram','인스타'],['youtube','유튜브'],['tiktok','틱톡']] as const).map(([key,label])=><label key={key} className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 p-3"><input type="checkbox" checked={platforms[key]} onChange={(e)=>setPlatforms((prev)=>({...prev,[key]:e.target.checked}))}/>{label}</label>)}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
            <button type="button" onClick={sendTelegram} disabled={sendingTelegram || !connection.telegram} className="w-full rounded-xl bg-sky-600 px-4 py-4 text-lg font-black disabled:opacity-40">{sendingTelegram ? "전송 중..." : connection.telegram ? (reelBlob ? "릴스와 발행 승인 요청 보내기" : "발행 승인 요청 보내기") : "텔레그램 연결이 필요합니다"}</button>
            <p className="text-sm leading-6 text-slate-400">{reelBlob ? "생성된 WebM 릴스 파일과 캡션, 승인·취소 버튼을 함께 보냅니다." : "릴스를 먼저 만들면 텔레그램에서 영상까지 확인할 수 있습니다."}</p>
            <Link href="/content/telegram-setup" className="rounded-xl border border-sky-700 px-4 py-4 text-center font-black text-sky-300">연결 설정</Link>
          </div>
          <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-900 p-4">
            <div className="flex items-center justify-between gap-3"><div><h3 className="font-black">유튜브 쇼츠 업로드</h3><p className="mt-1 text-xs text-slate-400">구글 계정을 연결한 뒤 방금 만든 WebM 파일을 선택하세요.</p></div>{connection.youtube ? <button type="button" onClick={async()=>{await fetch("/api/content/youtube/disconnect",{method:"POST"});location.reload();}} className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-bold">연결 해제</button> : youtubeConfigured ? <a href="/api/content/youtube/auth" className="rounded-lg bg-red-600 px-3 py-2 text-sm font-black">유튜브 계정 연결</a> : <Link href="/content/youtube-setup" className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-black">연결 설정 보기</Link>}</div>
            <input type="file" accept="video/*,.webm" onChange={(e)=>setYoutubeFile(e.target.files?.[0]||null)} className="mt-4 block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm" />
            <div className="mt-3 grid grid-cols-[1fr_130px] gap-2"><select value={youtubePrivacy} onChange={(e)=>setYoutubePrivacy(e.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3"><option value="private">비공개</option><option value="unlisted">일부 공개</option><option value="public">공개</option></select><button type="button" onClick={uploadYoutube} disabled={!connection.youtube||!youtubeFile||youtubeUploading} className="rounded-xl bg-red-600 px-3 py-3 font-black disabled:opacity-40">{youtubeUploading?`${youtubeProgress}%`:`쇼츠 업로드`}</button></div>
            {youtubeUploading&&<div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-red-500" style={{width:`${youtubeProgress}%`}} /></div>}
          </div>
          <p className="mt-3 rounded-xl bg-slate-900 p-3 text-sm leading-6 text-slate-300">{automationMessage}</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold sm:grid-cols-4">
            {([['telegram','텔레그램'],['instagram','인스타'],['youtube','유튜브'],['tiktok','틱톡']] as const).map(([key,label])=><div key={key} className="rounded-lg border border-slate-800 p-2 text-center">{label} · <span className={connection[key]?"text-emerald-400":"text-amber-400"}>{connection[key]?"연결됨":"키 필요"}</span></div>)}
          </div>
        </div>
        <p className="mt-4 rounded-xl bg-slate-950 p-4 text-sm leading-6 text-slate-400">기존 경기 분석 기능은 변경하지 않았습니다. 텔레그램은 환경변수 입력 후 바로 작동하며, 인스타그램·유튜브·틱톡 자동 게시에는 각 플랫폼의 공식 개발자 승인과 계정 토큰이 필요합니다.</p>
      </section>
    </section>
  </main>;
}


function buildNarration(d: ContentData, headline: string) {
  const predicted = Number(d.homeWinRate) >= 50 ? d.home : d.away;
  return [
    headline,
    `선발 투수는 ${d.away} ${d.awayStarter}, 평균자책점 ${d.awayEra}, ${d.home} ${d.homeStarter}, 평균자책점 ${d.homeEra}입니다.`,
    `최근 열 경기 흐름은 ${d.away} ${d.awayRecent}, ${d.home} ${d.homeRecent}입니다.`,
    `맞대결 기록은 ${d.away} ${d.awayH2h}, ${d.home} ${d.homeH2h}입니다.`,
    `장군 AI는 ${predicted} 우세, 예상 점수 ${d.awayScore} 대 ${d.homeScore}로 분석했습니다.`,
    `더 자세한 분석은 장군 AI에서 확인하세요.`,
  ];
}

function drawSubtitle(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  ctx.save(); ctx.textAlign = "center"; ctx.font = "900 38px Arial";
  const lines: string[] = []; let current = "";
  for (const ch of String(text || "")) {
    const test = current + ch;
    if (ctx.measureText(test).width > 890 && current) { lines.push(current); current = ch; } else current = test;
  }
  if (current) lines.push(current);
  const shown = lines.slice(0, 2); const boxH = 54 + shown.length * 48;
  ctx.fillStyle = "rgba(0,0,0,.72)"; ctx.beginPath(); ctx.roundRect(65, y - boxH + 15, 950, boxH, 24); ctx.fill();
  ctx.fillStyle = "#fff"; shown.forEach((line, index) => ctx.fillText(line, x, y - (shown.length - 1 - index) * 48));
  ctx.restore();
}

function drawCard(ctx: CanvasRenderingContext2D, index: number, d: ContentData, headline: string) {
  const W = 1080, H = 1350;
  ctx.clearRect(0, 0, W, H);
  paintBackground(ctx, W, H, index);
  drawHeader(ctx, d, index);

  const rate = clampPercent(d.homeWinRate);
  const awayRate = 100 - rate;
  const predictedHome = rate >= 50;
  const pickTeam = predictedHome ? d.home : d.away;
  const pickRate = predictedHome ? rate : awayRate;

  if (index === 0) {
    pill(ctx, 70, 260, 390, 56, "오늘 가장 주목할 경기", "#ff4f67");
    headlineText(ctx, headline, 70, 390, 900, 78);
    versusBlock(ctx, d.away, d.home, 70, 650, 940, 200);
    ctx.fillStyle = "#8ea0b8"; ctx.font = "800 28px Arial";
    ctx.fillText("SPORTS AI 추천", 70, 940);
    ctx.fillStyle = "#ffffff"; ctx.font = "900 62px Arial";
    ctx.fillText(`${pickTeam} 우세`, 70, 1015);
    progressBar(ctx, 70, 1075, 940, 42, pickRate, predictedHome ? "#4d9cff" : "#ff5b72");
    ctx.fillStyle = "#ffffff"; ctx.font = "900 54px Arial"; ctx.textAlign = "right";
    ctx.fillText(`${pickRate}%`, 1010, 1165); ctx.textAlign = "left";
  }

  if (index === 1) {
    sectionTitle(ctx, "선발투수 비교", "오늘 승부를 가를 핵심", 70, 260);
    starterCard(ctx, 70, 430, 440, 600, "원정", d.away, d.awayStarter, d.awayEra, "#ff5b72");
    starterCard(ctx, 570, 430, 440, 600, "홈", d.home, d.homeStarter, d.homeEra, "#4d9cff");
    vsCircle(ctx, 540, 725);
    ctx.fillStyle = "#8ea0b8"; ctx.font = "700 26px Arial";
    ctx.fillText("ERA가 낮을수록 안정적인 투구를 뜻합니다.", 70, 1125);
  }

  if (index === 2) {
    sectionTitle(ctx, "최근 10경기", "팀 흐름을 한눈에", 70, 260);
    formCard(ctx, 70, 440, 940, 260, d.away, d.awayRecent, "#ff5b72");
    formCard(ctx, 70, 750, 940, 260, d.home, d.homeRecent, "#4d9cff");
    summaryBox(ctx, d.summary, 70, 1080, 940, 120);
  }

  if (index === 3) {
    sectionTitle(ctx, "최근 맞대결", "상대 전적에서 찾는 힌트", 70, 260);
    matchupScore(ctx, 70, 470, 940, 430, d.away, d.home, d.awayH2h, d.homeH2h);
    ctx.fillStyle = "#8ea0b8"; ctx.font = "800 27px Arial";
    ctx.fillText("최근 맞대결 기준", 70, 990);
    summaryBox(ctx, d.summary, 70, 1040, 940, 150);
  }

  if (index === 4) {
    pill(ctx, 70, 270, 330, 56, "SPORTS AI 최종 예측", "#7c5cff");
    ctx.fillStyle = "#ffffff"; ctx.font = "900 76px Arial";
    wrap(ctx, `${pickTeam} 승리 예상`, 70, 430, 940, 90);
    ctx.textAlign = "center";
    ctx.fillStyle = "#8ea0b8"; ctx.font = "800 27px Arial"; ctx.fillText("예상 스코어", 540, 635);
    ctx.fillStyle = "#ffffff"; ctx.font = "900 150px Arial"; ctx.fillText(`${d.awayScore} : ${d.homeScore}`, 540, 790);
    ctx.fillStyle = predictedHome ? "#4d9cff" : "#ff5b72"; ctx.font = "900 72px Arial";
    ctx.fillText(`승리 확률 ${pickRate}%`, 540, 930);
    ctx.textAlign = "left";
    progressBar(ctx, 70, 1000, 940, 46, pickRate, predictedHome ? "#4d9cff" : "#ff5b72");
    summaryBox(ctx, d.summary, 70, 1100, 940, 110);
  }

  if (index === 5) {
    pill(ctx, 70, 275, 320, 56, "분석은 여기서 끝이 아닙니다", "#16b981");
    headlineText(ctx, "선발 · 최근 흐름 · 맞대결\n한 번에 확인하세요", 70, 420, 920, 78);
    ctaBox(ctx, 70, 760, 940, 180);
    ctx.fillStyle = "#8ea0b8"; ctx.font = "800 28px Arial";
    wrap(ctx, "매일 업데이트되는 야구 분석을 장군 AI에서 확인하세요.", 70, 1040, 920, 42);
  }

  drawFooter(ctx, index);
}

function paintBackground(ctx: CanvasRenderingContext2D, w: number, h: number, index: number) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#07101d"); g.addColorStop(0.55, "#0c1524"); g.addColorStop(1, "#111b2c");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.save(); ctx.globalAlpha = 0.16;
  ctx.fillStyle = index % 2 ? "#4d9cff" : "#7c5cff";
  ctx.beginPath(); ctx.arc(1010, 80, 330, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ff5b72"; ctx.beginPath(); ctx.arc(-80, 1290, 260, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,.045)"; ctx.lineWidth = 1;
  for (let y = 180; y < h; y += 90) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
}

function drawHeader(ctx: CanvasRenderingContext2D, d: ContentData, index: number) {
  ctx.fillStyle = "#ffffff"; ctx.font = "900 28px Arial"; ctx.fillText(d.league, 70, 92);
  ctx.fillStyle = "#8ea0b8"; ctx.font = "800 25px Arial"; ctx.textAlign = "right"; ctx.fillText(d.date, 1010, 92);
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.fillRect(70, 125, 940, 2);
  ctx.fillStyle = "#8ea0b8"; ctx.font = "800 22px Arial"; ctx.fillText(`${index + 1} / 6`, 70, 168);
}

function drawFooter(ctx: CanvasRenderingContext2D, index: number) {
  ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.fillRect(70, 1250, 940, 2);
  ctx.fillStyle = "#ffffff"; ctx.font = "900 24px Arial"; ctx.fillText("SPORTS AI", 70, 1300);
  const x = 820; for (let i = 0; i < 6; i++) { ctx.fillStyle = i === index ? "#4d9cff" : "#2a3547"; round(ctx, x + i * 34, 1283, i === index ? 28 : 12, 12, 6); ctx.fill(); }
}

function sectionTitle(ctx: CanvasRenderingContext2D, title: string, sub: string, x: number, y: number) {
  ctx.fillStyle = "#ffffff"; ctx.font = "900 72px Arial"; ctx.fillText(title, x, y);
  ctx.fillStyle = "#8ea0b8"; ctx.font = "800 28px Arial"; ctx.fillText(sub, x, y + 55);
}

function headlineText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, size: number) {
  ctx.fillStyle = "#ffffff"; ctx.font = `900 ${size}px Arial`; wrap(ctx, text, x, y, max, size * 1.15);
}

function pill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, text: string, color: string) {
  ctx.fillStyle = color; round(ctx, x, y, w, h, h / 2); ctx.fill();
  ctx.fillStyle = "#ffffff"; ctx.font = "900 25px Arial"; ctx.textAlign = "center"; ctx.fillText(text, x + w / 2, y + 37); ctx.textAlign = "left";
}

function versusBlock(ctx: CanvasRenderingContext2D, away: string, home: string, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "rgba(255,255,255,.055)"; round(ctx, x, y, w, h, 32); ctx.fill();
  teamBadge(ctx, x + 95, y + 100, away, "#ff5b72");
  teamBadge(ctx, x + w - 95, y + 100, home, "#4d9cff");
  ctx.fillStyle = "#ffffff"; ctx.font = "900 44px Arial"; ctx.textAlign = "left"; ctx.fillText(shortTeam(away), x + 170, y + 118);
  ctx.textAlign = "right"; ctx.fillText(shortTeam(home), x + w - 170, y + 118);
  ctx.textAlign = "center"; ctx.fillStyle = "#8ea0b8"; ctx.font = "900 30px Arial"; ctx.fillText("VS", x + w / 2, y + 112); ctx.textAlign = "left";
}

function starterCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, tag: string, team: string, name: string, era: string, accent: string) {
  ctx.fillStyle = "rgba(255,255,255,.055)"; round(ctx, x, y, w, h, 34); ctx.fill();
  ctx.fillStyle = accent; round(ctx, x, y, w, 12, 6); ctx.fill();
  pill(ctx, x + 30, y + 38, 100, 46, tag, accent);
  teamBadge(ctx, x + w / 2, y + 155, team, accent, 68);
  ctx.fillStyle = "#ffffff"; ctx.font = "900 40px Arial"; ctx.textAlign = "center"; wrapCentered(ctx, shortTeam(team), x + w / 2, y + 270, w - 60, 46);
  ctx.fillStyle = "#a8b6c9"; ctx.font = "800 28px Arial"; wrapCentered(ctx, name || "선발 미정", x + w / 2, y + 365, w - 60, 36);
  const shownEra = cleanStat(era);
  ctx.fillStyle = "#8ea0b8"; ctx.font = "800 24px Arial"; ctx.fillText("시즌 ERA", x + w / 2, y + 485);
  ctx.fillStyle = shownEra === "기록 없음" ? "#a8b6c9" : "#ffffff"; ctx.font = shownEra === "기록 없음" ? "900 34px Arial" : "900 78px Arial";
  ctx.fillText(shownEra, x + w / 2, y + 555); ctx.textAlign = "left";
}

function formCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, team: string, recent: string, accent: string) {
  ctx.fillStyle = "rgba(255,255,255,.055)"; round(ctx, x, y, w, h, 30); ctx.fill();
  teamBadge(ctx, x + 75, y + 78, team, accent, 48);
  ctx.fillStyle = "#ffffff"; ctx.font = "900 42px Arial"; ctx.fillText(shortTeam(team), x + 145, y + 92);
  const wl = parseWinLoss(recent);
  ctx.textAlign = "right"; ctx.fillStyle = accent; ctx.font = "900 52px Arial"; ctx.fillText(wl.label, x + w - 40, y + 94); ctx.textAlign = "left";
  const results = buildFormDots(wl.wins, wl.losses, 10);
  results.forEach((win, i) => { ctx.fillStyle = win ? "#22c55e" : "#ef4444"; ctx.beginPath(); ctx.arc(x + 70 + i * 82, y + 180, 25, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#ffffff"; ctx.font = "900 20px Arial"; ctx.textAlign = "center"; ctx.fillText(win ? "승" : "패", x + 70 + i * 82, y + 188); });
  ctx.textAlign = "left";
}

function matchupScore(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, away: string, home: string, awayRecord: string, homeRecord: string) {
  ctx.fillStyle = "rgba(255,255,255,.055)"; round(ctx, x, y, w, h, 34); ctx.fill();
  teamBadge(ctx, x + 165, y + 120, away, "#ff5b72", 62); teamBadge(ctx, x + w - 165, y + 120, home, "#4d9cff", 62);
  ctx.fillStyle = "#ffffff"; ctx.font = "900 40px Arial"; ctx.textAlign = "center"; ctx.fillText(shortTeam(away), x + 165, y + 225); ctx.fillText(shortTeam(home), x + w - 165, y + 225);
  ctx.font = "900 92px Arial"; ctx.fillStyle = "#ff5b72"; ctx.fillText(cleanStat(awayRecord), x + 165, y + 345); ctx.fillStyle = "#4d9cff"; ctx.fillText(cleanStat(homeRecord), x + w - 165, y + 345);
  ctx.fillStyle = "#8ea0b8"; ctx.font = "900 34px Arial"; ctx.fillText("VS", x + w / 2, y + 280); ctx.textAlign = "left";
}

function ctaBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, "#4d9cff"); g.addColorStop(1, "#7c5cff");
  ctx.fillStyle = g; round(ctx, x, y, w, h, 32); ctx.fill();
  ctx.fillStyle = "#ffffff"; ctx.font = "900 31px Arial"; ctx.fillText("지금 전체 분석 보기", x + 45, y + 65);
  ctx.font = "900 38px Arial"; ctx.fillText("sports-ai-alpha.vercel.app", x + 45, y + 125);
  ctx.textAlign = "right"; ctx.font = "900 60px Arial"; ctx.fillText("→", x + w - 45, y + 115); ctx.textAlign = "left";
}

function summaryBox(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "rgba(255,255,255,.045)"; round(ctx, x, y, w, h, 24); ctx.fill();
  ctx.fillStyle = "#a8b6c9"; ctx.font = "700 25px Arial"; wrap(ctx, text, x + 28, y + 42, w - 56, 35);
}

function progressBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, percent: number, color: string) {
  ctx.fillStyle = "#263247"; round(ctx, x, y, w, h, h / 2); ctx.fill();
  const fillW = Math.max(h, w * Math.max(0, Math.min(100, percent)) / 100);
  ctx.fillStyle = color; round(ctx, x, y, fillW, h, h / 2); ctx.fill();
}

function teamBadge(ctx: CanvasRenderingContext2D, x: number, y: number, team: string, color: string, r = 52) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ffffff"; ctx.font = `900 ${Math.round(r * .72)}px Arial`; ctx.textAlign = "center"; ctx.fillText(teamInitial(team), x, y + Math.round(r * .25)); ctx.textAlign = "left";
}

function vsCircle(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#0b1322"; ctx.beginPath(); ctx.arc(x, y, 48, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#34435a"; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = "#ffffff"; ctx.font = "900 26px Arial"; ctx.textAlign = "center"; ctx.fillText("VS", x, y + 9); ctx.textAlign = "left";
}

function cleanStat(value: string) { const s = String(value || "").trim(); return !s || s === "-" || s === "불러오는 중" ? "기록 없음" : s; }
function clampPercent(value: string) { const n = Number(String(value || "").replace(/[^0-9.]/g, "")); return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 50; }
function teamInitial(team: string) { const clean = String(team || "?").replace(/[^A-Za-z0-9가-힣]/g, ""); return clean.slice(0, 1).toUpperCase() || "?"; }
function shortTeam(team: string) { const s = String(team || "팀").trim(); return s.length > 10 ? `${s.slice(0, 10)}…` : s; }
function parseWinLoss(value: string) { const s = String(value || ""); const w = Number((s.match(/(\d+)\s*승/) || [])[1] || 0); const l = Number((s.match(/(\d+)\s*패/) || [])[1] || 0); return { wins: w, losses: l, label: w || l ? `${w}승 ${l}패` : cleanStat(s) }; }
function buildFormDots(wins: number, losses: number, count: number) { const total = Math.max(1, wins + losses); const winCount = Math.max(0, Math.min(count, Math.round(count * wins / total))); return Array.from({ length: count }, (_, i) => i < winCount); }
function wrapCentered(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, line: number) { const old = ctx.textAlign; ctx.textAlign = "center"; const chars = String(text || ""); let row = ""; const rows: string[] = []; for (const ch of chars) { const test = row + ch; if (ctx.measureText(test).width > max && row) { rows.push(row); row = ch; } else row = test; } if (row) rows.push(row); rows.slice(0, 2).forEach((r, i) => ctx.fillText(r, x, y + i * line)); ctx.textAlign = old; }
function wrap(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,max:number,line:number){String(text||"").split("\n").forEach((part)=>{let lineText="";for(const ch of part){const test=lineText+ch;if(ctx.measureText(test).width>max&&lineText){ctx.fillText(lineText,x,y);y+=line;lineText=ch}else lineText=test}if(lineText){ctx.fillText(lineText,x,y);y+=line}})}
function round(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}

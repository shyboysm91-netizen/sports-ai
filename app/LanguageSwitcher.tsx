"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type Language = "ko" | "en";

const EXACT: Record<string, string> = {
  "어제": "Yesterday", "오늘": "Today", "내일": "Tomorrow",
  "종합": "Overview", "선발": "Starting Pitchers", "맞대결": "Head-to-Head",
  "구종": "Pitch Arsenal", "최근전적": "Recent Form", "최근 경기": "Recent Games",
  "AI 분석": "AI Analysis", "종합 분석": "Overall Analysis", "최종 결론": "Final Pick",
  "원정팀": "Away", "홈팀": "Home", "원정": "Away", "홈": "Home",
  "경기 분석 보기": "View Game Analysis", "경기장 미정": "Venue TBD",
  "불러오는 중": "Loading", "경기 일정을 불러오는 중입니다.": "Loading the game schedule.",
  "경기 일정을 불러오지 못했습니다.": "Could not load the game schedule.",
  "예정된 경기가 없습니다.": "No games scheduled.", "다른 날짜를 선택해 주세요.": "Please select another date.",
  "사이트 소개": "About", "개인정보처리방침": "Privacy Policy", "이용약관": "Terms of Use", "문의하기": "Contact",
  "오늘의 모든 경기 분석 보기": "View All Today's Game Analyses", "전체 경기 보기": "View All Games",
  "승리 확률": "Win Probability", "예상 스코어": "Projected Score", "신뢰도": "Confidence",
  "선발투수": "Starting Pitcher", "선발투수 비교": "Starting Pitcher Comparison",
  "팀 전력": "Team Strength", "불펜": "Bullpen", "불펜 피로도": "Bullpen Fatigue",
  "최근 10경기": "Last 10 Games", "시즌 성적": "Season Stats", "상대전적": "Head-to-Head Record",
  "홈 등판": "Home Starts", "원정 등판": "Away Starts", "오늘 경기장 성적": "Venue Performance",
  "표본 없음": "No Sample", "정보 없음": "No Data", "미정": "TBD", "분석 중": "Analyzing",
  "승": "W", "패": "L", "무": "T", "경기": "games", "경기 수": "Games",
  "평균 득점": "Runs per Game", "평균 실점": "Runs Allowed per Game",
  "팀 타율": "Team AVG", "출루율": "OBP", "장타율": "SLG", "OPS": "OPS",
  "방어율": "ERA", "이닝": "IP", "삼진": "Strikeouts", "볼넷": "Walks", "투구수": "Pitches",
  "추천": "Pick", "주의": "Caution", "핵심 변수": "Key Factors", "추천 이유": "Why This Pick",
  "언더": "Under", "오버": "Over", "기준점": "Total Line", "예상 총득점": "Projected Total",
  "배당 정보 없음": "Odds Unavailable", "판단 보류": "No Pick",
  "매우 높음": "Very High", "높음": "High", "보통": "Medium", "낮음": "Low",
};

const PHRASES: Array<[RegExp, string]> = [
  [/오늘의 (KBO|MLB|NPB) 경기 분석/g, "Today's $1 Game Analysis"],
  [/(KBO|MLB|NPB) 경기 일정/g, "$1 Schedule"],
  [/([0-9]+)경기/g, "$1 games"],
  [/한국시간/g, "Korea Time"],
  [/선발\s+/g, "Starter "],
  [/경기 분석/g, "Game Analysis"],
  [/AI 승부예측/g, "AI Prediction"],
  [/승부예측/g, "Prediction"],
  [/최근\s*([0-9]+)경기/g, "Last $1 Games"],
  [/홈팀 승리/g, "Home Team Win"],
  [/원정팀 승리/g, "Away Team Win"],
];

const TEAMS: Record<string, string> = {
  "LA 에인절스":"Los Angeles Angels", "애리조나 다이아몬드백스":"Arizona Diamondbacks", "볼티모어 오리올스":"Baltimore Orioles",
  "보스턴 레드삭스":"Boston Red Sox", "시카고 컵스":"Chicago Cubs", "신시내티 레즈":"Cincinnati Reds",
  "클리블랜드 가디언스":"Cleveland Guardians", "콜로라도 로키스":"Colorado Rockies", "디트로이트 타이거스":"Detroit Tigers",
  "휴스턴 애스트로스":"Houston Astros", "캔자스시티 로열스":"Kansas City Royals", "LA 다저스":"Los Angeles Dodgers",
  "워싱턴 내셔널스":"Washington Nationals", "뉴욕 메츠":"New York Mets", "애슬레틱스":"Athletics",
  "피츠버그 파이리츠":"Pittsburgh Pirates", "샌디에이고 파드리스":"San Diego Padres", "시애틀 매리너스":"Seattle Mariners",
  "샌프란시스코 자이언츠":"San Francisco Giants", "세인트루이스 카디널스":"St. Louis Cardinals", "탬파베이 레이스":"Tampa Bay Rays",
  "텍사스 레인저스":"Texas Rangers", "토론토 블루제이스":"Toronto Blue Jays", "미네소타 트윈스":"Minnesota Twins",
  "필라델피아 필리스":"Philadelphia Phillies", "애틀랜타 브레이브스":"Atlanta Braves", "시카고 화이트삭스":"Chicago White Sox",
  "마이애미 말린스":"Miami Marlins", "뉴욕 양키스":"New York Yankees", "밀워키 브루어스":"Milwaukee Brewers",
  "두산 베어스":"Doosan Bears", "LG 트윈스":"LG Twins", "KT 위즈":"KT Wiz", "SSG 랜더스":"SSG Landers", "NC 다이노스":"NC Dinos",
  "KIA 타이거즈":"KIA Tigers", "롯데 자이언츠":"Lotte Giants", "삼성 라이온즈":"Samsung Lions", "한화 이글스":"Hanwha Eagles", "키움 히어로즈":"Kiwoom Heroes",
  "요미우리":"Yomiuri Giants", "한신":"Hanshin Tigers", "주니치":"Chunichi Dragons", "히로시마":"Hiroshima Carp", "요코하마":"Yokohama DeNA BayStars",
  "야쿠르트":"Yakult Swallows", "소프트뱅크":"SoftBank Hawks", "니혼햄":"Nippon-Ham Fighters", "라쿠텐":"Rakuten Eagles", "치바롯데":"Chiba Lotte Marines",
  "오릭스":"Orix Buffaloes", "세이부":"Seibu Lions",
};

const originals = new WeakMap<Text, string>();

function translateText(input: string) {
  const leading = input.match(/^\s*/)?.[0] ?? "";
  const trailing = input.match(/\s*$/)?.[0] ?? "";
  let value = input.trim();
  if (!value) return input;
  value = TEAMS[value] ?? EXACT[value] ?? value;
  for (const [ko, en] of Object.entries(TEAMS)) value = value.split(ko).join(en);
  for (const [pattern, replacement] of PHRASES) value = value.replace(pattern, replacement);
  return leading + value + trailing;
}

function translateDocument(language: Language) {
  document.documentElement.lang = language;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current: Node | null;
  while ((current = walker.nextNode())) nodes.push(current as Text);
  for (const node of nodes) {
    const parent = node.parentElement;
    if (!parent || ["SCRIPT", "STYLE", "NOSCRIPT"].includes(parent.tagName)) continue;
    if (!originals.has(node)) originals.set(node, node.nodeValue ?? "");
    const original = originals.get(node) ?? "";
    const nextValue = language === "en" ? translateText(original) : original;
    if (node.nodeValue !== nextValue) node.nodeValue = nextValue;
  }
}

export default function LanguageSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const [language, setLanguage] = useState<Language>("ko");

  useEffect(() => {
    const fromPath = pathname === "/en" || pathname.startsWith("/en/");
    const saved = localStorage.getItem("sports-ai-language") as Language | null;
    setLanguage(fromPath ? "en" : saved === "en" ? "en" : "ko");
  }, [pathname]);

  useEffect(() => {
    localStorage.setItem("sports-ai-language", language);
    translateDocument(language);
    const observer = new MutationObserver(() => translateDocument(language));
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [language, pathname]);

  function toggle() {
    const next: Language = language === "ko" ? "en" : "ko";
    setLanguage(next);
    localStorage.setItem("sports-ai-language", next);

    if (next === "en") {
      if (pathname === "/") router.push("/en");
      else if (pathname.startsWith("/analysis/")) router.push(`/en${pathname}${location.search}`);
    } else {
      if (pathname === "/en") router.push("/");
      else if (pathname.startsWith("/en/analysis/")) router.push(pathname.replace(/^\/en/, "") + location.search);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={language === "ko" ? "Switch to English" : "한국어로 변경"}
      className="fixed right-3 top-3 z-[9999] rounded-full border border-slate-700 bg-slate-950/95 px-3 py-2 text-xs font-black text-white shadow-lg backdrop-blur hover:border-blue-400"
    >
      {language === "ko" ? "🇺🇸 English" : "🇰🇷 한국어"}
    </button>
  );
}

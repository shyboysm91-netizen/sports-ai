/**
 * Sports AI 운영 캐시 정책
 *
 * 경기 일정: 5분
 * 최근 경기/팀 흐름: 10~30분
 * 순위/팀 시즌 기록: 30분
 * 날씨: 1시간
 * 투수 시즌/구종/상대 기록: 6시간
 * 유료 배당 API: 30분
 *
 * Next.js fetch의 `next.revalidate`는 Vercel Data Cache에 저장되어
 * 같은 URL을 여러 사용자가 요청해도 외부 API를 매번 다시 호출하지 않습니다.
 */
export const CACHE_SECONDS = {
  schedule: 300,
  recent: 600,
  teamSeason: 1800,
  weather: 3600,
  pitcherDetail: 21600,
  odds: 1800,
} as const;

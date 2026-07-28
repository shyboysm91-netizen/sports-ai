import type { Category } from './types';

export const topicPool: Record<Category, string[]> = {
  health: [
    '아침에 물을 마시면 좋은 이유',
    '혈압 관리를 위해 줄여야 할 습관',
    '잠을 자도 피곤할 때 확인할 생활습관',
    '식후 혈당 급상승을 줄이는 방법',
    '눈이 자주 피로할 때 쉬어야 하는 신호',
    '간 건강을 위해 피해야 할 생활습관',
    '걷기 운동을 꾸준히 하면 생기는 변화',
    '콜레스테롤 관리에 도움 되는 식사 원칙',
    '장 건강을 위해 챙기면 좋은 습관',
    '수면의 질을 떨어뜨리는 저녁 습관'
  ],
  pregnancy: [
    '임신 중 다리 부종을 줄이는 생활습관',
    '임신 중 병원에 바로 연락해야 하는 증상',
    '임신 주차별 태동을 살펴보는 방법',
    '임산부가 물을 충분히 마셔야 하는 이유',
    '임신 중 편안하게 잠드는 자세',
    '출산가방을 준비하기 좋은 시기',
    '임신 중 철분 섭취 시 알아둘 점',
    '임신 후기 배뭉침과 진통을 구분할 때 볼 점',
    '임신 중 허리 통증을 줄이는 생활습관',
    '임산부가 식중독을 특히 조심해야 하는 이유'
  ]
};

export function pickTopics(category: Category, count: number, excluded: string[] = []) {
  const available = topicPool[category].filter(topic => !excluded.includes(topic));
  const source = available.length >= count ? available : topicPool[category];
  return [...source].sort(() => Math.random() - 0.5).slice(0, count);
}

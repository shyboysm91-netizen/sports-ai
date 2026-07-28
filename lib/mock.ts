import { Category, ContentDraft } from './types';
import { getSeoulNow } from './time';

export function makeMockDraft(category: Category, topic: string, scheduledTime: string): ContentDraft {
  const isHealth = category === 'health';
  const safeTopic = topic.trim() || (isHealth ? '아침에 물을 마시면 좋은 이유' : '임신 중 다리 부종을 줄이는 생활습관');
  const cards = [
    { title: safeTopic, body: '오늘 꼭 알아둘 핵심 내용을 1분 안에 정리했습니다.' },
    { title: '왜 중요할까요?', body: isHealth ? '작은 생활습관이 컨디션과 건강 관리에 큰 차이를 만들 수 있습니다.' : '임신 중에는 몸의 변화가 빠르므로 증상을 세심하게 살펴보는 것이 중요합니다.' },
    { title: '첫 번째', body: '무리하지 않고 꾸준히 실천할 수 있는 방법부터 시작하세요.' },
    { title: '두 번째', body: '몸의 반응을 기록하면 나에게 맞는 생활 패턴을 찾기 쉽습니다.' },
    { title: '세 번째', body: '불편한 증상이 지속되거나 심해지면 전문가와 상담하세요.' },
    { title: '주의할 점', body: isHealth ? '질환이나 복용 중인 약이 있다면 일반적인 조언을 그대로 적용하지 마세요.' : '출혈, 심한 통증, 태동 감소 등 이상 신호가 있다면 즉시 의료진에게 문의하세요.' },
    { title: '오늘의 실천', body: '한 가지만 정해 오늘부터 가볍게 시작해 보세요.' },
    { title: '저장해 두세요', body: '건강한 하루를 위한 정보를 매일 전해드립니다.' }
  ];
  return {
    id: crypto.randomUUID(), category, topic: safeTopic, title: safeTopic, cards,
    caption: `${safeTopic}\n\n카드에서 핵심 내용을 확인해 보세요. 개인의 상태에 따라 차이가 있을 수 있으며, 증상이 있거나 치료 중이라면 의료진과 상담하세요.`,
    hashtags: isHealth ? ['건강정보','건강습관','생활건강','건강관리','오늘건강'] : ['임신정보','임산부','예비엄마','임신생활','엄마노트'],
    scheduledDate: getSeoulNow().date, scheduledTime, status: 'draft'
  };
}

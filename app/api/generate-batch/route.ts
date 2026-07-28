import { NextResponse } from 'next/server';
import { makeMockDraft } from '../../../lib/mock';
import { pickTopics } from '../../../lib/topics';
import type { Category, ContentDraft } from '../../../lib/types';
import { saveDrafts } from '../../../lib/db';
import { getSeoulNow } from '../../../lib/time';

const defaultTimes = ['08:00', '11:00', '14:00', '17:00', '20:00'];

async function createWithAi(category: Category, topic: string, scheduledTime: string): Promise<ContentDraft> {
  if (!process.env.OPENAI_API_KEY) return makeMockDraft(category, topic, scheduledTime);

  const prompt = `한국어 인스타그램 카드뉴스를 작성해줘.\n카테고리: ${category === 'health' ? '일반 건강' : '임산부'}\n주제: ${topic}\n조건: 정확하고 이해하기 쉽게 작성, 8장, 과장·공포 유도·진단·치료 단정 금지, 각 카드 본문은 80자 이내. 임산부 내용에는 위험 신호와 의료진 상담 안내를 포함. 마지막 장은 저장과 팔로우 유도.\n반드시 JSON만 출력: {"title":"","cards":[{"title":"","body":""}],"caption":"","hashtags":[""]}`;

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-5-mini', input: prompt, text: { format: { type: 'json_object' } } })
    });
    if (!response.ok) return makeMockDraft(category, topic, scheduledTime);
    const result = await response.json();
    const parsed = JSON.parse(result.output_text || '{}');
    if (!parsed.title || !Array.isArray(parsed.cards) || parsed.cards.length !== 8) return makeMockDraft(category, topic, scheduledTime);
    return {
      id: crypto.randomUUID(), category, topic, title: parsed.title,
      cards: parsed.cards, caption: parsed.caption || '', hashtags: parsed.hashtags || [],
      scheduledDate: getSeoulNow().date, scheduledTime, status: 'draft'
    };
  } catch {
    return makeMockDraft(category, topic, scheduledTime);
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { times?: string[]; healthCount?: number; excludedTopics?: string[] };
  const times = Array.isArray(body.times) && body.times.length === 5 ? body.times : defaultTimes;
  const healthCount = Math.min(5, Math.max(0, Number(body.healthCount ?? 3)));
  const pregnancyCount = 5 - healthCount;
  const excluded = Array.isArray(body.excludedTopics) ? body.excludedTopics : [];
  const health = pickTopics('health', healthCount, excluded).map(topic => ({ category: 'health' as const, topic }));
  const pregnancy = pickTopics('pregnancy', pregnancyCount, excluded).map(topic => ({ category: 'pregnancy' as const, topic }));
  const plan: Array<{ category: Category; topic: string }> = [];
  while (health.length || pregnancy.length) {
    if (health.length) plan.push(health.shift()!);
    if (pregnancy.length) plan.push(pregnancy.shift()!);
  }

  const drafts: ContentDraft[] = [];
  for (let index = 0; index < 5; index += 1) {
    const item = plan[index];
    drafts.push(await createWithAi(item.category, item.topic, times[index]));
  }
  await saveDrafts(drafts);
  return NextResponse.json({ drafts });
}

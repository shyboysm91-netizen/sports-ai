import { NextResponse } from 'next/server';
import { makeMockDraft } from '../../../lib/mock';
import type { Category, ContentDraft } from '../../../lib/types';
import { saveDrafts } from '../../../lib/db';
import { getSeoulNow } from '../../../lib/time';

export async function POST(req: Request) {
  const { category, topic, scheduledTime } = await req.json() as { category: Category; topic: string; scheduledTime: string };
  if (!['health','pregnancy'].includes(category)) return NextResponse.json({error:'잘못된 카테고리입니다.'},{status:400});

  if (!process.env.OPENAI_API_KEY) { const draft = makeMockDraft(category, topic, scheduledTime); await saveDrafts([draft]); return NextResponse.json({ draft, mode:'mock' }); }

  const prompt = `한국어 인스타그램 카드뉴스 JSON을 작성해줘. 카테고리=${category === 'health' ? '일반 건강' : '임산부'}, 주제=${topic || '유용한 생활 정보'}. 정확하고 이해하기 쉽게 8장으로 만들고, 과장·공포 유도·진단·치료 단정은 금지. 각 카드 본문은 80자 이내. 임산부 내용은 위험 신호와 의료진 상담 안내 포함. JSON 형식: {"title":"", "cards":[{"title":"","body":""}], "caption":"", "hashtags":[""]}`;
  const response = await fetch('https://api.openai.com/v1/responses', {
    method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.OPENAI_API_KEY}`},
    body:JSON.stringify({ model:process.env.OPENAI_MODEL || 'gpt-5-mini', input:prompt, text:{format:{type:'json_object'}} })
  });
  if (!response.ok) return NextResponse.json({ draft: makeMockDraft(category, topic, scheduledTime), mode:'fallback' });
  const result = await response.json();
  const text = result.output_text || '{}';
  let parsed;
  try { parsed = JSON.parse(text); } catch { return NextResponse.json({ draft: makeMockDraft(category, topic, scheduledTime), mode:'fallback' }); }
  if (!parsed.title || !Array.isArray(parsed.cards) || parsed.cards.length !== 8) return NextResponse.json({ draft: makeMockDraft(category, topic, scheduledTime), mode:'fallback' });
  const draft: ContentDraft = { id:crypto.randomUUID(), category, topic:topic || parsed.title, title:parsed.title, cards:parsed.cards, caption:parsed.caption, hashtags:parsed.hashtags, scheduledDate:getSeoulNow().date, scheduledTime, status:'draft' };
  await saveDrafts([draft]);
  return NextResponse.json({draft, mode:'ai'});
}

import { NextResponse } from 'next/server';
import { getDraft, updateDraft } from '../../../../lib/db';

async function answerCallback(token: string, callbackId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackId, text }),
  });
}

export async function POST(req: Request) {
  const secret = req.headers.get('x-telegram-bot-api-secret-token');
  if (process.env.TELEGRAM_WEBHOOK_SECRET && secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const update = await req.json();
  const callback = update.callback_query;
  if (!callback) return NextResponse.json({ ok: true });

  const [action, draftId] = String(callback.data || '').split(':');
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const allowedChatId = process.env.TELEGRAM_CHAT_ID;
  const callbackChatId = String(callback.message?.chat?.id || '');
  if (allowedChatId && callbackChatId !== String(allowedChatId)) {
    if (token) await answerCallback(token, callback.id, '허용되지 않은 계정입니다.');
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const draft = await getDraft(draftId);
  if (!draft) {
    if (token) await answerCallback(token, callback.id, '콘텐츠를 찾을 수 없습니다.');
    return NextResponse.json({ error: 'draft not found' }, { status: 404 });
  }

  if (action === 'cancel') {
    await updateDraft(draftId, { status: 'cancelled' });
    if (token) await answerCallback(token, callback.id, '발행을 취소했습니다.');
    return NextResponse.json({ ok: true, action, draftId });
  }

  if (action === 'publish') {
    if (draft.status === 'published') {
      if (token) await answerCallback(token, callback.id, '이미 게시된 콘텐츠입니다.');
      return NextResponse.json({ ok: true, duplicate: true });
    }
    // 실제 Meta 게시 연결은 카드 PNG 공개 URL 생성 단계에서 활성화됩니다.
    if (token) await answerCallback(token, callback.id, '발행 승인 완료. 이미지 게시 연결을 준비 중입니다.');
    return NextResponse.json({ ok: true, action, draftId, status: draft.status });
  }

  if (token) await answerCallback(token, callback.id, '잘못된 요청입니다.');
  return NextResponse.json({ error: 'invalid action' }, { status: 400 });
}

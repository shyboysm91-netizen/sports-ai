import { NextResponse } from 'next/server';
import type { ContentDraft } from '../../../../lib/types';
import { sendDraftToTelegram } from '../../../../lib/telegram';
import { updateDraft } from '../../../../lib/db';

export async function POST(req: Request) {
  const { draft } = await req.json() as { draft: ContentDraft };
  try {
    const messageId = await sendDraftToTelegram(draft);
    await updateDraft(draft.id, { status: 'telegram_sent', telegram_message_id: messageId });
    return NextResponse.json({ ok: true, messageId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '텔레그램 전송 실패' }, { status: 500 });
  }
}

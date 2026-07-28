import { NextResponse } from 'next/server';
import { listDueDrafts, updateDraft } from '../../../../lib/db';
import { getSeoulNow } from '../../../../lib/time';
import { sendDraftToTelegram } from '../../../../lib/telegram';

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const now = getSeoulNow();
    const drafts = await listDueDrafts(now.date, now.time);
    const sent: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];
    for (const draft of drafts) {
      try {
        const messageId = await sendDraftToTelegram(draft);
        await updateDraft(draft.id, { status: 'telegram_sent', telegram_message_id: messageId });
        sent.push(draft.id);
      } catch (error) {
        failed.push({ id: draft.id, error: error instanceof Error ? error.message : '전송 실패' });
      }
    }
    return NextResponse.json({ ok: true, now, checked: drafts.length, sent, failed });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '예약 전송 실패' }, { status: 500 });
  }
}

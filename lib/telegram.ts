import type { ContentDraft } from './types';

export async function sendDraftToTelegram(draft: ContentDraft) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error('TELEGRAM_BOT_TOKEN과 TELEGRAM_CHAT_ID를 입력하세요.');
  const text = `📌 ${draft.category === 'health' ? '건강' : '임산부'} 카드뉴스\n\n${draft.title}\n예정: ${draft.scheduledDate} ${draft.scheduledTime}\n카드: ${draft.cards.length}장\n\n발행 버튼을 누르면 인스타그램·페이스북 게시를 진행합니다.`;
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId, text,
      reply_markup: { inline_keyboard: [
        [{ text: '✅ 발행', callback_data: `publish:${draft.id}` }],
        [{ text: '❌ 취소', callback_data: `cancel:${draft.id}` }],
      ] },
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.description || '텔레그램 전송 실패');
  return Number(data.result?.message_id || 0);
}

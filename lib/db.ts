import type { ContentDraft } from './types';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function hasDatabase() {
  return Boolean(url && serviceKey);
}

function headers(extra?: Record<string, string>) {
  return {
    apikey: serviceKey || '',
    Authorization: `Bearer ${serviceKey || ''}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

export async function saveDrafts(drafts: ContentDraft[]) {
  if (!hasDatabase()) return;
  const rows = drafts.map(draft => ({
    id: draft.id,
    category: draft.category,
    topic: draft.topic,
    title: draft.title,
    cards: draft.cards,
    caption: draft.caption,
    hashtags: draft.hashtags,
    scheduled_date: draft.scheduledDate,
    scheduled_time: draft.scheduledTime,
    status: draft.status,
    telegram_message_id: draft.telegramMessageId || null,
    updated_at: new Date().toISOString(),
  }));
  const response = await fetch(`${url}/rest/v1/content_drafts?on_conflict=id`, {
    method: 'POST',
    headers: headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify(rows),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Supabase 저장 실패: ${await response.text()}`);
}

export async function listDrafts(): Promise<ContentDraft[]> {
  if (!hasDatabase()) return [];
  const response = await fetch(`${url}/rest/v1/content_drafts?select=*&order=scheduled_date.desc,scheduled_time.asc&limit=200`, {
    headers: headers(), cache: 'no-store'
  });
  if (!response.ok) throw new Error(`Supabase 조회 실패: ${await response.text()}`);
  const rows = await response.json();
  return rows.map((row: any) => ({
    id: row.id, category: row.category, topic: row.topic, title: row.title,
    cards: row.cards || [], caption: row.caption || '', hashtags: row.hashtags || [],
    scheduledDate: row.scheduled_date, scheduledTime: row.scheduled_time,
    status: row.status, telegramMessageId: row.telegram_message_id || undefined,
  }));
}

export async function getDraft(id: string): Promise<ContentDraft | null> {
  if (!hasDatabase()) return null;
  const response = await fetch(`${url}/rest/v1/content_drafts?id=eq.${encodeURIComponent(id)}&select=*&limit=1`, {
    headers: headers(), cache: 'no-store'
  });
  if (!response.ok) throw new Error(`Supabase 조회 실패: ${await response.text()}`);
  const [row] = await response.json();
  if (!row) return null;
  return {
    id: row.id, category: row.category, topic: row.topic, title: row.title,
    cards: row.cards || [], caption: row.caption || '', hashtags: row.hashtags || [],
    scheduledDate: row.scheduled_date, scheduledTime: row.scheduled_time,
    status: row.status, telegramMessageId: row.telegram_message_id || undefined,
  };
}

export async function updateDraft(id: string, values: Record<string, unknown>) {
  if (!hasDatabase()) return;
  const response = await fetch(`${url}/rest/v1/content_drafts?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: headers({ Prefer: 'return=minimal' }),
    body: JSON.stringify({ ...values, updated_at: new Date().toISOString() }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Supabase 수정 실패: ${await response.text()}`);
}

export async function deleteDraft(id: string) {
  if (!hasDatabase()) return;
  const response = await fetch(`${url}/rest/v1/content_drafts?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE', headers: headers(), cache: 'no-store'
  });
  if (!response.ok) throw new Error(`Supabase 삭제 실패: ${await response.text()}`);
}

export async function listDueDrafts(date: string, time: string): Promise<ContentDraft[]> {
  if (!hasDatabase()) return [];
  const query = `${url}/rest/v1/content_drafts?select=*&scheduled_date=eq.${date}&scheduled_time=lte.${encodeURIComponent(time)}&status=eq.draft&order=scheduled_time.asc`;
  const response = await fetch(query, { headers: headers(), cache: 'no-store' });
  if (!response.ok) throw new Error(`예약 콘텐츠 조회 실패: ${await response.text()}`);
  const rows = await response.json();
  return rows.map((row: any) => ({
    id: row.id, category: row.category, topic: row.topic, title: row.title,
    cards: row.cards || [], caption: row.caption || '', hashtags: row.hashtags || [],
    scheduledDate: row.scheduled_date, scheduledTime: row.scheduled_time,
    status: row.status,
  }));
}

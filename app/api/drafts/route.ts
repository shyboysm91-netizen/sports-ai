import { NextResponse } from 'next/server';
import { deleteDraft, hasDatabase, listDrafts, saveDrafts } from '../../../lib/db';
import type { ContentDraft } from '../../../lib/types';

export async function GET() {
  if (!hasDatabase()) return NextResponse.json({ drafts: [], mode: 'local' });
  try { return NextResponse.json({ drafts: await listDrafts(), mode: 'database' }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : '조회 실패' }, { status: 500 }); }
}

export async function POST(req: Request) {
  const { drafts } = await req.json() as { drafts: ContentDraft[] };
  try { await saveDrafts(drafts); return NextResponse.json({ ok: true, mode: hasDatabase() ? 'database' : 'local' }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : '저장 실패' }, { status: 500 }); }
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });
  try { await deleteDraft(id); return NextResponse.json({ ok: true }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : '삭제 실패' }, { status: 500 }); }
}

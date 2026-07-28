create table if not exists public.content_drafts (
  id uuid primary key,
  category text not null check (category in ('health', 'pregnancy')),
  topic text not null,
  title text not null,
  cards jsonb not null default '[]'::jsonb,
  caption text not null default '',
  hashtags jsonb not null default '[]'::jsonb,
  scheduled_date date not null,
  scheduled_time time not null,
  status text not null default 'draft' check (status in ('draft', 'telegram_sent', 'published', 'cancelled')),
  telegram_message_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_drafts_schedule_idx
  on public.content_drafts (scheduled_date, scheduled_time, status);

alter table public.content_drafts enable row level security;
-- 이 앱은 서버의 service role key로만 접근합니다. 브라우저 공개 정책은 만들지 않습니다.

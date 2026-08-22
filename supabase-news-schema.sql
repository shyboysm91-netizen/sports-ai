-- 기존 테이블은 변경하거나 삭제하지 않습니다. Supabase SQL Editor에서 이 파일만 실행하세요.
create extension if not exists pgcrypto;
create table if not exists public.news (
  id uuid primary key default gen_random_uuid(), title text not null, slug text not null unique,
  summary text not null, content jsonb not null default '{}'::jsonb,
  category text not null check (category in ('KBO','MLB','NPB','축구','NBA','기타')),
  image_url text not null default '/news-default.svg', source_urls jsonb not null default '[]'::jsonb,
  source_names jsonb not null default '[]'::jsonb, players jsonb not null default '[]'::jsonb,
  teams jsonb not null default '[]'::jsonb, source_published_at timestamptz,
  published_at timestamptz not null default now(), created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), status text not null default 'draft' check (status in ('draft','scheduled','published','private')),
  seo_title text not null, seo_description text not null, content_hash text not null unique,
  normalized_title text not null, reading_minutes integer not null default 3 check (reading_minutes > 0)
);
create index if not exists news_publication_idx on public.news(status,published_at desc);
create index if not exists news_category_idx on public.news(category,published_at desc);
create index if not exists news_normalized_title_idx on public.news(normalized_title);
create table if not exists public.news_settings (id text primary key default 'default', enabled boolean not null default true, updated_at timestamptz not null default now());
insert into public.news_settings(id,enabled) values('default',true) on conflict(id) do nothing;
alter table public.news enable row level security;
alter table public.news_settings enable row level security;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('news-images','news-images',true,5242880,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=true;
-- 서비스 역할 키를 사용하는 서버 API만 쓰기/관리 작업을 수행합니다.

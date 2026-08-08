-- Releases table for NexCore Labs
-- Run in Supabase SQL editor

create table if not exists public.releases (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  date date not null,
  summary text not null,
  user_updates jsonb not null default '{}'::jsonb,
  developer_notes jsonb not null default '{}'::jsonb,
  is_major_release boolean not null default false,
  major_details jsonb
);

alter table public.releases enable row level security;

create policy "Public read access for releases"
  on public.releases
  for select
  using (true);

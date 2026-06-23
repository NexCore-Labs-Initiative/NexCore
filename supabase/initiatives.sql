-- Public catalogue for NexCore Labs initiatives.
-- Apply in the Supabase SQL editor or through the team's migration workflow.

create table if not exists public.initiatives (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status text not null check (status in ('launched', 'active', 'in-development', 'incubation', 'concept')),
  categories text[] not null default '{}'::text[] check (cardinality(categories) > 0),
  featured boolean not null default false,
  sort_order integer not null default 0,
  visibility text not null default 'draft' check (visibility in ('public', 'draft', 'private')),
  title jsonb not null check (title ? 'en' and title ? 'ar'),
  mission jsonb not null check (mission ? 'en' and mission ? 'ar'),
  summary jsonb not null check (summary ? 'en' and summary ? 'ar'),
  overview jsonb not null check (overview ? 'en' and overview ? 'ar'),
  highlights jsonb not null default '[]'::jsonb check (jsonb_typeof(highlights) = 'array'),
  image jsonb,
  primary_link jsonb,
  launched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists initiatives_public_sort_idx
  on public.initiatives (visibility, featured desc, sort_order asc, updated_at desc);

create index if not exists initiatives_categories_gin_idx
  on public.initiatives using gin (categories);

create or replace function public.set_initiatives_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists initiatives_set_updated_at on public.initiatives;
create trigger initiatives_set_updated_at
before update on public.initiatives
for each row execute function public.set_initiatives_updated_at();

alter table public.initiatives enable row level security;

drop policy if exists "Public initiatives are readable" on public.initiatives;
create policy "Public initiatives are readable"
  on public.initiatives
  for select
  to anon, authenticated
  using (visibility = 'public');

comment on table public.initiatives is
  'Bilingual public catalogue for launched and emerging NexCore Labs initiatives.';

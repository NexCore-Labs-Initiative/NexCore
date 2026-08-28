create table if not exists public.docs_feedback_responses (
  id uuid primary key default gen_random_uuid(),
  page_path text not null,
  page_key text not null default 'how-to-use',
  locale text not null,
  vote text not null,
  client_hash text not null,
  response_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint docs_feedback_responses_page_key_check check (page_key = 'how-to-use'),
  constraint docs_feedback_responses_locale_check check (locale in ('en', 'ar')),
  constraint docs_feedback_responses_vote_check check (vote in ('yes', 'no'))
);

create unique index if not exists docs_feedback_responses_daily_client_unique
  on public.docs_feedback_responses (page_key, locale, client_hash, response_date);

alter table public.docs_feedback_responses enable row level security;

revoke all on table public.docs_feedback_responses from anon;
revoke all on table public.docs_feedback_responses from authenticated;
grant all on table public.docs_feedback_responses to service_role;

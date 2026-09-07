-- Applications are accepted only through the validated server-side POST handler.
create table public.career_applications (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('marketing', 'social-media')),
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  email text not null check (char_length(email) <= 254 and email ~ '^[^[:space:]@]+@([a-z0-9-]+\.)*squ\.edu\.om$'),
  college_major text not null check (char_length(btrim(college_major)) between 1 and 160),
  academic_year text not null check (char_length(btrim(academic_year)) between 1 and 80),
  motivation text not null check (char_length(btrim(motivation)) between 1 and 2000),
  experience text not null check (char_length(btrim(experience)) between 1 and 2000),
  portfolio_url text check (portfolio_url is null or (char_length(portfolio_url) <= 500 and portfolio_url ~ '^https?://')),
  weekly_availability text not null check (char_length(btrim(weekly_availability)) between 1 and 120),
  role_answer text not null check (char_length(btrim(role_answer)) between 1 and 1500),
  status text not null default 'new' check (status in ('new', 'reviewed', 'closed')),
  created_at timestamptz not null default now()
);

alter table public.career_applications enable row level security;
revoke all on table public.career_applications from public, anon, authenticated;
-- No browser policies: neither anonymous nor signed-in users can read or write.
grant insert on table public.career_applications to service_role;
comment on table public.career_applications is 'Private Careers Beta applications; review via authorized database administration only.';

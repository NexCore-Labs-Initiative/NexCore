-- HISTORICAL COPY: applied to production on 2026-08-08.
-- NexCore Labs v3.3.0 — Trust & Foundations
-- Apply only after the compatible /api/public-metrics and /api/admin/access
-- deployment is live. See docs/database-rollback.md before production use.

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

-- Exposed public tables must always have RLS, even when browser grants are revoked.
alter table public.page_visits_daily enable row level security;
alter table public.project_counter enable row level security;
alter table public.project_moderation enable row level security;

revoke all on table public.page_visits_daily from anon, authenticated;
revoke all on table public.project_counter from anon, authenticated;
revoke all on table public.project_moderation from anon, authenticated;
grant all on table public.page_visits_daily to service_role;
grant all on table public.project_counter to service_role;
grant all on table public.project_moderation to service_role;

-- Access-control lists are server-owned. No browser role can enumerate or mutate them.
drop policy if exists "Anyone can read admins" on public.admins;
drop policy if exists "Only admins can delete" on public.admins;
drop policy if exists "Only admins can insert admins" on public.admins;
drop policy if exists "Only admins can update" on public.admins;
drop policy if exists "Admins can delete approved users" on public.approved_users;
drop policy if exists "Admins can update approved users" on public.approved_users;
drop policy if exists "Anyone can read approved users" on public.approved_users;
drop policy if exists "Authenticated users can insert approved users" on public.approved_users;
revoke all on table public.admins from anon, authenticated;
revoke all on table public.approved_users from anon, authenticated;
grant all on table public.admins to service_role;
grant all on table public.approved_users to service_role;

-- Newsletter writes already flow through /api/newsletter.
drop policy if exists "Allow public deletes" on public.email_subscribers;
drop policy if exists "Allow public email subscription" on public.email_subscribers;
drop policy if exists "Allow public inserts" on public.email_subscribers;
revoke all on table public.email_subscribers from anon, authenticated;
grant all on table public.email_subscribers to service_role;

-- Payments remain paused for v3.3.
drop policy if exists "anyone_can_insert_orders" on public.subscription_orders;
revoke insert on table public.subscription_orders from anon, authenticated;

-- Public profiles must obey the users table policies of the caller.
alter view public.user_public_profiles set (security_invoker = true);

-- Admin checks are kept outside the exposed Data API schema.
create or replace function private.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users
    where id = (select auth.uid()) and is_admin is true
  );
$$;
revoke all on function private.is_current_user_admin() from public, anon, authenticated;
grant execute on function private.is_current_user_admin() to service_role;

-- Replace the caller-controlled identity argument with auth.uid().
drop function if exists public.toggle_feature_vote(uuid, uuid);
create or replace function public.toggle_feature_vote(p_feature_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  existing_vote uuid;
  new_count integer;
  voted boolean;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.features
    where id = p_feature_id and is_approved is true
  ) then
    raise exception 'Feature not found' using errcode = 'P0002';
  end if;

  select id into existing_vote
  from public.feature_votes
  where feature_id = p_feature_id and user_id = caller_id
  for update;

  if existing_vote is not null then
    delete from public.feature_votes where id = existing_vote;
    update public.features
      set votes_count = greatest(0, votes_count - 1)
      where id = p_feature_id
      returning votes_count into new_count;
    voted := false;
  else
    insert into public.feature_votes (user_id, feature_id)
      values (caller_id, p_feature_id);
    update public.features
      set votes_count = votes_count + 1
      where id = p_feature_id
      returning votes_count into new_count;
    voted := true;
  end if;

  return json_build_object('votes_count', new_count, 'voted', voted);
end;
$$;
revoke all on function public.toggle_feature_vote(uuid) from public, anon;
grant execute on function public.toggle_feature_vote(uuid) to authenticated, service_role;

-- A member can only inspect their own vote records; mutations use the RPC above.
drop policy if exists "Anyone can read votes" on public.feature_votes;
drop policy if exists "Authenticated users can vote" on public.feature_votes;
drop policy if exists "Users can delete own votes" on public.feature_votes;
create policy "Members can read own votes"
  on public.feature_votes for select to authenticated
  using ((select auth.uid()) = user_id);
revoke insert, update, delete on table public.feature_votes from anon, authenticated;
grant select on table public.feature_votes to authenticated;

-- Keep intentionally anonymous roadmap calls, but constrain inputs and targets.
create or replace function public.toggle_anon_vote(p_feature_id uuid, p_fingerprint text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_fingerprint text := trim(coalesce(p_fingerprint, ''));
  already_voted boolean;
  new_count integer;
begin
  if length(normalized_fingerprint) < 32 or length(normalized_fingerprint) > 128
     or normalized_fingerprint !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'Invalid fingerprint' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.features
    where id = p_feature_id and is_approved is true
  ) then
    raise exception 'Feature not found' using errcode = 'P0002';
  end if;

  select exists(
    select 1 from public.anon_votes
    where feature_id = p_feature_id and fingerprint = normalized_fingerprint
  ) into already_voted;

  if already_voted then
    delete from public.anon_votes
      where feature_id = p_feature_id and fingerprint = normalized_fingerprint;
    update public.features set votes_count = greatest(0, votes_count - 1)
      where id = p_feature_id returning votes_count into new_count;
  else
    insert into public.anon_votes(feature_id, fingerprint)
      values (p_feature_id, normalized_fingerprint);
    update public.features set votes_count = votes_count + 1
      where id = p_feature_id returning votes_count into new_count;
  end if;

  return json_build_object('voted', not already_voted, 'votes_count', new_count);
end;
$$;
revoke all on function public.toggle_anon_vote(uuid, text) from public, authenticated;
grant execute on function public.toggle_anon_vote(uuid, text) to anon, service_role;

create or replace function public.submit_anon_suggestion(
  p_title text,
  p_description text,
  p_submitter_email text default null,
  p_submitter_name text default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_title text := trim(coalesce(p_title, ''));
  clean_description text := trim(coalesce(p_description, ''));
  clean_email text := lower(trim(coalesce(p_submitter_email, '')));
  clean_name text := trim(coalesce(p_submitter_name, ''));
  new_id uuid;
begin
  if length(clean_title) < 3 or length(clean_title) > 120 then
    raise exception 'Invalid title' using errcode = '22023';
  end if;
  if length(clean_description) > 2000 or length(clean_name) > 100 or length(clean_email) > 254 then
    raise exception 'Suggestion fields are too long' using errcode = '22023';
  end if;
  if clean_email <> '' and clean_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Invalid email' using errcode = '22023';
  end if;

  insert into public.features(
    title, description, status, submitter_email, submitter_name,
    is_anonymous, is_approved, created_by
  ) values (
    clean_title, clean_description, 'planned', nullif(clean_email, ''),
    nullif(clean_name, ''), true, null, null
  ) returning id into new_id;
  return json_build_object('id', new_id, 'status', 'pending');
end;
$$;
revoke all on function public.submit_anon_suggestion(text, text, text, text) from public, authenticated;
grant execute on function public.submit_anon_suggestion(text, text, text, text) to anon, service_role;

-- Deliberate execution grants for privileged application RPCs.
alter function public.get_pending_suggestions() set search_path = '';
alter function public.moderate_suggestion(uuid, boolean) set search_path = '';
alter function public.get_my_admin_status() set search_path = '';
alter function public.consume_ai_use(integer) set search_path = '';
alter function public.consume_ai_chat_use(integer) set search_path = '';
alter function public.get_ai_chat_usage(integer) set search_path = '';
alter function public.search_knowledge(vector, integer) set search_path = '';

revoke all on function public.get_pending_suggestions() from public, anon;
revoke all on function public.moderate_suggestion(uuid, boolean) from public, anon;
revoke all on function public.get_my_admin_status() from public, anon;
revoke all on function public.consume_ai_use(integer) from public, anon;
revoke all on function public.consume_ai_chat_use(integer) from public, anon;
revoke all on function public.get_ai_chat_usage(integer) from public, anon;
revoke all on function public.search_knowledge(vector, integer) from public, anon, authenticated;
grant execute on function public.get_pending_suggestions() to authenticated, service_role;
grant execute on function public.moderate_suggestion(uuid, boolean) to authenticated, service_role;
grant execute on function public.get_my_admin_status() to authenticated, service_role;
grant execute on function public.consume_ai_use(integer) to authenticated, service_role;
grant execute on function public.consume_ai_chat_use(integer) to authenticated, service_role;
grant execute on function public.get_ai_chat_usage(integer) to authenticated, service_role;
grant execute on function public.search_knowledge(vector, integer) to service_role;

-- Trigger helpers are not Data API endpoints.
revoke all on function public.check_email_authorization() from public, anon, authenticated;
revoke all on function public.allocate_project_public_id() from public, anon, authenticated;
revoke all on function public.projects_before_insert() from public, anon, authenticated;
revoke all on function public.set_users_updated_at() from public, anon, authenticated;
revoke all on function public.update_approved_users_updated_at() from public, anon, authenticated;

commit;

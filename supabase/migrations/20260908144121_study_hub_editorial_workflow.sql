-- Study Hub owns these records; Labs owns identity and administrator membership.
-- All mutations use a service-only, SECURITY INVOKER transaction after API authentication.
begin;

create table public.study_hub_colleges (
  id text primary key, code text not null unique, name text not null, name_ar text not null
);
create table public.study_hub_courses (
  id uuid primary key default gen_random_uuid(),
  college_id text not null references public.study_hub_colleges(id),
  code text not null unique check (code ~ '^[A-Z0-9][A-Z0-9 -]{1,29}$'),
  title text not null check (length(btrim(title)) between 1 and 200), title_ar text not null default ''
);
create table public.study_hub_settings (
  id boolean primary key default true check (id),
  semesters text[] not null, resource_types text[] not null, formats text[] not null,
  version integer not null default 1
);
insert into public.study_hub_settings values (true,
  array['Fall27','Summer27','Spring27','Summer26','Spring26','Fall25','Summer25','Spring25','Fall24','Summer24','Spring24','Fall23','Summer23','Spring23','Fall22','Summer22','Spring22','Fall21','Summer21','Spring21','Fall20','Summer20','Spring20'],
  array['Study plan','Books','Slides','Notes','Practice papers','Exams','Quizzes','Worked examples','Study guide'],
  array['pdf','word','powerpoint','excel','img','other'], 1);
insert into public.study_hub_colleges values
('agricultural-marine-sciences','CAMS','College of Agricultural and Marine Sciences','كلية العلوم الزراعية والبحرية'),
('arts-social-sciences','CASS','College of Arts and Social Sciences','كلية الآداب والعلوم الاجتماعية'),
('economics-political-science','CEPS','College of Economics and Political Science','كلية الاقتصاد والعلوم السياسية'),
('education','CEDU','College of Education','كلية التربية'),
('engineering','CENG','College of Engineering','كلية الهندسة'),
('law','CLAW','College of Law','كلية الحقوق'),
('medicine-health-sciences','CMHS','College of Medicine and Health Sciences','كلية الطب والعلوم الصحية'),
('nursing','CON','College of Nursing','كلية التمريض'),
('science','COS','College of Science','كلية العلوم');

create table public.study_hub_editors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now()
);
create table public.study_hub_resources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique default gen_random_uuid()::text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  course_id uuid references public.study_hub_courses(id),
  content jsonb, -- Approved display fields only. Never store review notes or actor IDs here.
  drive_key text unique,
  version integer not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  published_at timestamptz,
  check (status = 'draft' or (course_id is not null and content is not null and drive_key is not null and published_at is not null))
);
create table public.study_hub_resource_revisions (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.study_hub_resources(id),
  state text not null default 'draft' check (state in ('draft','submitted','published','discarded')),
  content jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  submitted_at timestamptz, reviewed_at timestamptz,
  history jsonb not null default '[]'::jsonb
);
create unique index study_hub_one_working_revision on public.study_hub_resource_revisions(resource_id)
  where state in ('draft','submitted');
create unique index study_hub_unique_submitted_drive on public.study_hub_resource_revisions((content->>'drive_key'))
  where state='submitted';
create index study_hub_resource_public_order on public.study_hub_resources(status,id);
create index study_hub_revision_resource on public.study_hub_resource_revisions(resource_id,created_at desc);
create index study_hub_courses_college on public.study_hub_courses(college_id);

alter table public.study_hub_colleges enable row level security;
alter table public.study_hub_courses enable row level security;
alter table public.study_hub_settings enable row level security;
alter table public.study_hub_resources enable row level security;
alter table public.study_hub_resource_revisions enable row level security;
alter table public.study_hub_editors enable row level security;
revoke all on public.study_hub_colleges, public.study_hub_courses, public.study_hub_settings,
  public.study_hub_resources, public.study_hub_resource_revisions, public.study_hub_editors from public, anon, authenticated;
grant select on public.study_hub_colleges, public.study_hub_courses, public.study_hub_settings,
  public.study_hub_resources to anon, authenticated;
grant all on public.study_hub_colleges, public.study_hub_courses, public.study_hub_settings,
  public.study_hub_resources, public.study_hub_resource_revisions, public.study_hub_editors to service_role;
create policy study_hub_colleges_read on public.study_hub_colleges for select to anon, authenticated using (true);
create policy study_hub_courses_read on public.study_hub_courses for select to anon, authenticated using (true);
create policy study_hub_settings_read on public.study_hub_settings for select to anon, authenticated using (true);
create policy study_hub_published_read on public.study_hub_resources for select to anon, authenticated using (status = 'published');

-- This helper is not a public API: execute is granted only to service_role below.
create function public.study_hub_validate(p jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare cfg public.study_hub_settings; k text; v text;
begin
  select * into strict cfg from public.study_hub_settings where id;
  foreach k in array array['title','description','semester','type','format','drive_url','drive_key'] loop
    if jsonb_typeof(p->k) is distinct from 'string' or length(btrim(p->>k)) = 0 then
      raise exception 'invalid_content:%', k using errcode = '22023';
    end if;
  end loop;
  if length(p->>'title') > 200 or length(p->>'description') > 10000
    or not ((p->>'semester') = any(cfg.semesters))
    or not ((p->>'type') = any(cfg.resource_types))
    or not ((p->>'format') = any(cfg.formats)) then
    raise exception 'invalid_metadata' using errcode = '22023';
  end if;
  if jsonb_typeof(p->'topics') is distinct from 'array' or jsonb_typeof(p->'languages') is distinct from 'array' then
    raise exception 'invalid_topics_or_languages' using errcode = '22023';
  end if;
  if jsonb_array_length(p->'topics') not between 1 and 30 or jsonb_array_length(p->'languages') not between 1 and 2
    or not (p->'languages' <@ '["ar","en"]'::jsonb) then
    raise exception 'invalid_topics_or_languages' using errcode = '22023';
  end if;
  for v in select jsonb_array_elements_text(p->'topics') loop
    if length(btrim(v)) not between 1 and 100 then raise exception 'invalid_topic' using errcode = '22023'; end if;
  end loop;
  if (p->>'drive_key') !~ '^[A-Za-z0-9_-]{5,200}$'
    or (p->>'drive_url') !~ '^https://drive[.]google[.]com/(file/d/[A-Za-z0-9_-]+/view|drive/folders/[A-Za-z0-9_-]+)([?]resourcekey=[A-Za-z0-9_-]+)?$' then
    raise exception 'invalid_drive_url' using errcode = '22023';
  end if;
  if coalesce(p->>'credit','') <> '' and coalesce((p->>'credit_permission')::boolean,false) is not true then
    raise exception 'credit_permission_required' using errcode = '22023';
  end if;
  if coalesce(p->>'course_id','') <> '' then
    if not exists (select 1 from public.study_hub_courses where id = (p->>'course_id')::uuid) then
      raise exception 'unknown_course' using errcode = '22023'; end if;
  elsif coalesce(p#>>'{course_proposal,code}','') !~ '^[A-Z0-9][A-Z0-9 -]{1,29}$'
    or length(btrim(coalesce(p#>>'{course_proposal,title}',''))) not between 1 and 200
    or not exists (select 1 from public.study_hub_colleges where id = p#>>'{course_proposal,college_id}') then
    raise exception 'course_required' using errcode = '22023';
  end if;
end $$;

create function public.study_hub_mutate(p_actor uuid, p_action text, p_id uuid default null,
  p_version integer default null, p_payload jsonb default '{}'::jsonb, p_actor_email text default '') returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  admin_ok boolean; editor_ok boolean; r public.study_hub_resource_revisions;
  resource public.study_hub_resources; course uuid; result_id uuid; note text; cfg public.study_hub_settings;
begin
  -- Both identity values come exclusively from auth.getUser(token) in the server API.
  -- This service-only function never accepts calls from browser database roles.
  select exists(select 1 from public.admins where email = lower(p_actor_email)) into admin_ok;
  select exists(select 1 from public.study_hub_editors where user_id = p_actor) into editor_ok;
  if not admin_ok and not editor_ok then raise exception 'access_denied' using errcode = '42501'; end if;
  if p_action in ('publish','return','archive','restore','grant_editor','revoke_editor','semesters') and not admin_ok then
    raise exception 'admin_required' using errcode = '42501'; end if;

  if p_action = 'grant_editor' then
    -- Existing Auth user is checked by the API and enforced by the foreign key.
    insert into public.study_hub_editors(user_id,granted_by) values(p_id,p_actor) on conflict(user_id) do nothing;
    return jsonb_build_object('ok',true);
  elsif p_action = 'revoke_editor' then
    delete from public.study_hub_editors where user_id = p_id;
    return jsonb_build_object('ok',true);
  elsif p_action = 'semesters' then
    select * into strict cfg from public.study_hub_settings where id for update;
    if cfg.version is distinct from p_version then raise exception 'version_conflict' using errcode = '40001'; end if;
    if jsonb_typeof(p_payload->'semesters') is distinct from 'array' then raise exception 'invalid_semesters' using errcode = '22023'; end if;
    if jsonb_array_length(p_payload->'semesters') not between 1 and 150 or exists(
      select 1 from jsonb_array_elements_text(p_payload->'semesters') s where s !~ '^(Spring|Summer|Fall)[0-9]{2}$')
      or (select count(*) <> count(distinct s) from jsonb_array_elements_text(p_payload->'semesters') s) then
      raise exception 'invalid_semesters' using errcode = '22023'; end if;
    if not (to_jsonb(cfg.semesters) <@ (p_payload->'semesters')) then
      raise exception 'existing_semesters_cannot_be_removed' using errcode = '22023'; end if;
    update public.study_hub_settings set semesters = array(select jsonb_array_elements_text(p_payload->'semesters')), version = version+1 where id;
    return jsonb_build_object('ok',true);
  elsif p_action = 'create' then
    insert into public.study_hub_resources default values returning * into resource;
    insert into public.study_hub_resource_revisions(resource_id,content,created_by,updated_by)
      values(resource.id,p_payload,p_actor,p_actor) returning id into result_id;
    return jsonb_build_object('id',result_id,'resource_id',resource.id);
  elsif p_action in ('revise','archive','restore') then
    select * into resource from public.study_hub_resources where id = p_id for update;
    if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
    if resource.version is distinct from p_version then raise exception 'version_conflict' using errcode = '40001'; end if;
    if p_action = 'revise' then
      if resource.status <> 'published' then raise exception 'resource_not_published' using errcode = '22023'; end if;
      insert into public.study_hub_resource_revisions(resource_id,content,created_by,updated_by)
        values(resource.id, resource.content || jsonb_build_object('course_id',resource.course_id,'drive_key',resource.drive_key,
          'credit_permission',false),p_actor,p_actor) returning id into result_id;
      return jsonb_build_object('id',result_id);
    end if;
    if (p_action = 'archive' and resource.status <> 'published') or (p_action = 'restore' and resource.status <> 'archived') then
      raise exception 'invalid_transition' using errcode = '22023'; end if;
    if exists(select 1 from public.study_hub_resource_revisions where resource_id = p_id and state in ('draft','submitted')) then
      raise exception 'resolve_working_revision_first' using errcode = '22023'; end if;
    update public.study_hub_resources set status = case when p_action='archive' then 'archived' else 'published' end,
      version=version+1, updated_at=now() where id = p_id;
    update public.study_hub_resource_revisions set history = history || jsonb_build_array(jsonb_build_object(
      'action',p_action,'actor',p_actor,'at',now())) where id = (
        select id from public.study_hub_resource_revisions where resource_id=p_id and state='published' order by reviewed_at desc limit 1);
    return jsonb_build_object('ok',true);
  end if;

  -- Lock resource before revision in every path to serialize publication/revision creation.
  select * into resource from public.study_hub_resources where id = (
    select resource_id from public.study_hub_resource_revisions where id=p_id) for update;
  select * into r from public.study_hub_resource_revisions where id=p_id for update;
  if not found then raise exception 'not_found' using errcode='P0002'; end if;
  if r.version is distinct from p_version then raise exception 'version_conflict' using errcode='40001'; end if;
  if p_action in ('save','submit','discard') and r.state <> 'draft'
    or p_action in ('withdraw','return','publish') and r.state <> 'submitted' then
    raise exception 'invalid_transition' using errcode='22023'; end if;
  if p_action = 'save' then
    r.content := p_payload;
  elsif p_action in ('submit','publish') then
    if p_action='publish' and coalesce(p_payload->>'course_id','') <> '' then
      r.content := (r.content - 'course_proposal') || jsonb_build_object('course_id',p_payload->>'course_id');
    end if;
    perform public.study_hub_validate(r.content);
    if exists(select 1 from public.study_hub_resources where drive_key=r.content->>'drive_key' and id<>r.resource_id)
      or exists(select 1 from public.study_hub_resource_revisions where state='submitted'
        and content->>'drive_key'=r.content->>'drive_key' and resource_id<>r.resource_id) then
      raise exception 'duplicate_drive_resource' using errcode='23505'; end if;
    if p_action='submit' then
      r.state := 'submitted'; r.submitted_at := now();
    else
      course := nullif(r.content->>'course_id','')::uuid;
      if course is null then
        -- Never overwrite an existing course using an editor proposal.
        insert into public.study_hub_courses(code,title,title_ar,college_id) values (
          r.content#>>'{course_proposal,code}',r.content#>>'{course_proposal,title}',
          coalesce(r.content#>>'{course_proposal,title_ar}',''),r.content#>>'{course_proposal,college_id}')
          returning id into course;
      end if;
      update public.study_hub_resources set status='published',course_id=course,
        content = r.content - array['course_id','course_proposal','credit_permission','drive_key'],
        drive_key=r.content->>'drive_key',version=version+1,updated_at=now(),published_at=coalesce(published_at,now())
        where id=r.resource_id;
      r.state := 'published'; r.reviewed_by := p_actor; r.reviewed_at := now();
    end if;
  elsif p_action in ('withdraw','return') then
    note := btrim(coalesce(p_payload->>'note',''));
    if p_action='return' and length(note) not between 1 and 2000 then raise exception 'review_note_required' using errcode='22023'; end if;
    r.state := 'draft';
    if p_action='return' then r.reviewed_by := p_actor; r.reviewed_at := now(); end if;
  elsif p_action='discard' then r.state := 'discarded';
  else raise exception 'invalid_action' using errcode='22023'; end if;
  update public.study_hub_resource_revisions set content=r.content,state=r.state,version=version+1,
    updated_by=p_actor,updated_at=now(),submitted_at=r.submitted_at,reviewed_by=r.reviewed_by,reviewed_at=r.reviewed_at,
    history=history || jsonb_build_array(jsonb_build_object('action',p_action,'actor',p_actor,'at',now(),'note',note)) where id=r.id;
  return jsonb_build_object('id',r.id,'version',r.version+1,'state',r.state);
end $$;
revoke all on function public.study_hub_validate(jsonb), public.study_hub_mutate(uuid,text,uuid,integer,jsonb,text) from public, anon, authenticated;
grant execute on function public.study_hub_validate(jsonb), public.study_hub_mutate(uuid,text,uuid,integer,jsonb,text) to service_role;
commit;

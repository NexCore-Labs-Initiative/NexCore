begin;
create table public.study_hub_submissions (
 id uuid primary key default gen_random_uuid(), source text not null default 'google_sheets' check(source='google_sheets'),
 source_spreadsheet_id text not null, source_sheet_id bigint not null, external_response_id uuid not null,
 submitted_at timestamptz not null, source_row_number integer not null check(source_row_number>=2),
 submitter_name text not null default '' check(length(submitter_name)<=200),
 submitter_note text not null default '' check(length(submitter_note)<=2000),
 credit_consent boolean not null default false, terms_accepted boolean not null default false,
 source_content jsonb not null, source_hash text not null check(source_hash ~ '^[a-f0-9]{64}$'),
 review_content jsonb not null, source_changed boolean not null default false,
 validation_issues jsonb not null default '[]',
 status text not null default 'pending' check(status in ('pending','rejected','converted')),
 review_notes text not null default '' check(length(review_notes)<=2000),
 reviewed_by uuid references auth.users(id) on delete set null, reviewed_at timestamptz,
 resource_id uuid references public.study_hub_resources(id), revision_id uuid references public.study_hub_resource_revisions(id),
 version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(source_spreadsheet_id,source_sheet_id,external_response_id),
 check ((status='converted') = (resource_id is not null and revision_id is not null))
);
create index study_hub_submissions_queue on public.study_hub_submissions(status,created_at desc,id);
alter table public.study_hub_submissions enable row level security;
revoke all on public.study_hub_submissions from public,anon,authenticated;
grant all on public.study_hub_submissions to service_role;

-- The API supplies verified actor identity. Browser roles cannot execute either function.
create function public.study_hub_import_submission(p_actor uuid,p_actor_email text,p_source text,p_sheet bigint,p_row integer,p_data jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.study_hub_submissions; inserted_id uuid;
begin
 if not exists(select 1 from public.admins where email=lower(p_actor_email)) then raise exception 'admin_required' using errcode='42501'; end if;
 insert into public.study_hub_submissions(source_spreadsheet_id,source_sheet_id,external_response_id,source_row_number,
 submitted_at,submitter_name,submitter_note,credit_consent,terms_accepted,source_content,source_hash,review_content,validation_issues)
 values(p_source,p_sheet,(p_data->>'external_response_id')::uuid,p_row,(p_data->>'submitted_at')::timestamptz,
 p_data->>'submitter_name',p_data->>'submitter_note',(p_data->>'credit_consent')::boolean,(p_data->>'terms_accepted')::boolean,
 p_data->'source_content',p_data->>'source_hash',p_data->'source_content',p_data->'validation_issues')
 on conflict(source_spreadsheet_id,source_sheet_id,external_response_id) do nothing returning id into inserted_id;
 if inserted_id is not null then return jsonb_build_object('result','imported'); end if;
 select * into strict s from public.study_hub_submissions where source_spreadsheet_id=p_source and source_sheet_id=p_sheet
 and external_response_id=(p_data->>'external_response_id')::uuid for update;
 if s.source_hash=p_data->>'source_hash' then
  update public.study_hub_submissions set source_row_number=p_row where id=s.id;
  return jsonb_build_object('result','already_synced');
 end if;
 update public.study_hub_submissions set submitted_at=(p_data->>'submitted_at')::timestamptz,
 submitter_name=p_data->>'submitter_name',submitter_note=p_data->>'submitter_note',credit_consent=(p_data->>'credit_consent')::boolean,
 terms_accepted=(p_data->>'terms_accepted')::boolean,source_content=p_data->'source_content',source_hash=p_data->>'source_hash',
 source_row_number=p_row,source_changed=true,validation_issues=p_data->'validation_issues',version=version+1,updated_at=now() where id=s.id;
 return jsonb_build_object('result','source_changed');
end $$;

create function public.study_hub_review_submission(p_actor uuid,p_actor_email text,p_action text,p_id uuid,p_version integer,p_payload jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.study_hub_submissions; c jsonb; result jsonb; duplicate_id uuid; note text;
begin
 if not exists(select 1 from public.admins where email=lower(p_actor_email)) then raise exception 'admin_required' using errcode='42501'; end if;
 select * into s from public.study_hub_submissions where id=p_id for update;
 if not found then raise exception 'not_found' using errcode='P0002'; end if;
 if p_action='convert' and s.status='converted' then return jsonb_build_object('resource_id',s.resource_id,'id',s.revision_id); end if;
 if s.version is distinct from p_version then raise exception 'version_conflict' using errcode='40001'; end if;
 note := coalesce(p_payload->>'note',s.review_notes);
 if length(note)>2000 then raise exception 'invalid_note' using errcode='22023'; end if;
 if p_action='reopen' then
  if s.status<>'rejected' then raise exception 'invalid_transition' using errcode='22023'; end if;
  update public.study_hub_submissions set status='pending',version=version+1,updated_at=now() where id=s.id;
 elsif p_action='reject' then
  if s.status<>'pending' then raise exception 'invalid_transition' using errcode='22023'; end if;
  update public.study_hub_submissions set status='rejected',review_notes=note,reviewed_by=p_actor,reviewed_at=now(),version=version+1,updated_at=now() where id=s.id;
 elsif p_action in ('save','convert') then
  if s.status<>'pending' then raise exception 'invalid_transition' using errcode='22023'; end if;
  -- Build a positive allowlist, including nested fields, before any draft creation.
  select coalesce(jsonb_object_agg(key,value),'{}') into c from jsonb_each(coalesce(p_payload->'content',s.review_content))
   where key=any(array['title','description','semester','type','format','drive_url','drive_key','credit','credit_permission','course_id','topics','languages','course_proposal','translations']);
  if p_action='convert' then
   if s.source_changed and coalesce((p_payload->>'acknowledge_source')::boolean,false) is not true then raise exception 'source_review_required' using errcode='22023'; end if;
   if not s.terms_accepted then raise exception 'terms_required' using errcode='22023'; end if;
   if not s.credit_consent and coalesce(c->>'credit','')<>'' then raise exception 'credit_not_consented' using errcode='22023'; end if;
   perform public.study_hub_validate(c);
   perform pg_advisory_xact_lock(hashtextextended(c->>'drive_key',0));
   select id into duplicate_id from public.study_hub_resources where drive_key=c->>'drive_key' limit 1;
   if duplicate_id is null then
    select resource_id into duplicate_id from public.study_hub_resource_revisions where state in ('draft','submitted') and content->>'drive_key'=c->>'drive_key' limit 1;
   end if;
   if duplicate_id is not null then return jsonb_build_object('duplicate_resource_id',duplicate_id); end if;
   result := public.study_hub_mutate(p_actor,'create',null,null,c,p_actor_email);
   update public.study_hub_submissions set status='converted',resource_id=(result->>'resource_id')::uuid,revision_id=(result->>'id')::uuid,
    review_content=c,review_notes=note,reviewed_by=p_actor,reviewed_at=now(),source_changed=false,version=version+1,updated_at=now() where id=s.id;
   return result;
  end if;
  update public.study_hub_submissions set review_content=c,review_notes=note,
   source_changed=case when coalesce((p_payload->>'acknowledge_source')::boolean,false) then false else source_changed end,
   version=version+1,updated_at=now() where id=s.id;
 else raise exception 'invalid_action' using errcode='22023'; end if;
 return jsonb_build_object('id',s.id,'version',s.version+1);
end $$;
revoke all on function public.study_hub_import_submission(uuid,text,text,bigint,integer,jsonb),
 public.study_hub_review_submission(uuid,text,text,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.study_hub_import_submission(uuid,text,text,bigint,integer,jsonb),
 public.study_hub_review_submission(uuid,text,text,uuid,integer,jsonb) to service_role;
commit;

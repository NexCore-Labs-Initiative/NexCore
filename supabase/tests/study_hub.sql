-- Run on a local/test database only. All fixtures roll back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(1);
insert into auth.users(id,email) values
('10000000-0000-0000-0000-000000000001','study-admin@example.invalid'),
('10000000-0000-0000-0000-000000000002','study-editor@example.invalid'),
('10000000-0000-0000-0000-000000000003','study-member@example.invalid');
insert into public.admins(email) values ('study-admin@example.invalid');
create function pg_temp.mutate(actor uuid, action text, id uuid default null, version integer default null, payload jsonb default '{}'::jsonb) returns jsonb language sql as $$
select public.study_hub_mutate(actor,action,id,version,payload,case when actor='10000000-0000-0000-0000-000000000001'::uuid then 'study-admin@example.invalid' else 'member@example.invalid' end);
$$;
set local role service_role;
do $$
declare
  admin_id uuid := '10000000-0000-0000-0000-000000000001';
  editor_id uuid := '10000000-0000-0000-0000-000000000002';
  member_id uuid := '10000000-0000-0000-0000-000000000003';
  result jsonb; revision uuid; resource uuid; data jsonb; course uuid; v integer; count_before integer;
begin
  begin perform pg_temp.mutate(member_id,'create'); raise exception 'ordinary user gained access'; exception when insufficient_privilege then null; end;
  perform pg_temp.mutate(admin_id,'grant_editor',editor_id);
  begin perform pg_temp.mutate(editor_id,'grant_editor',member_id); raise exception 'editor granted access'; exception when insufficient_privilege then null; end;
  data := jsonb_build_object('title','Arrays guide','description','Reviewed notes','topics',jsonb_build_array('Arrays'),
    'semester','Fall27','type','Study plan','format','pdf','languages',jsonb_build_array('ar','en'),
    'drive_url','https://drive.google.com/drive/folders/test_drive_001','drive_key','test_drive_001',
    'credit','Student team','credit_permission',true,'translations',jsonb_build_object(),
    'course_proposal',jsonb_build_object('code','COMP1001','title','Programming','college_id','science'));
  result := pg_temp.mutate(editor_id,'create',null,null,data);
  revision := (result->>'id')::uuid; resource := (result->>'resource_id')::uuid;
  assert (select content is null from public.study_hub_resources where id=resource), 'draft leaked approved content';
  begin perform pg_temp.mutate(editor_id,'publish',revision,1); raise exception 'editor published'; exception when insufficient_privilege then null; end;
  perform pg_temp.mutate(editor_id,'submit',revision,1);
  begin perform pg_temp.mutate(editor_id,'save',revision,2,data); raise exception 'submitted revision editable'; exception when invalid_parameter_value then null; end;
  begin perform pg_temp.mutate(admin_id,'return',revision,2); raise exception 'empty return note accepted'; exception when invalid_parameter_value then null; end;
  perform pg_temp.mutate(admin_id,'return',revision,2,'{"note":"Please improve the description"}');
  perform pg_temp.mutate(editor_id,'save',revision,3,data || '{"description":"Improved notes"}');
  begin perform pg_temp.mutate(editor_id,'save',revision,3,data); raise exception 'lost update accepted'; exception when serialization_failure then null; end;
  perform pg_temp.mutate(editor_id,'submit',revision,4);
  perform pg_temp.mutate(admin_id,'publish',revision,5);
  assert (select status='published' and content->>'description'='Improved notes' from public.study_hub_resources where id=resource), 'publish failed';
  assert (select not (content ?| array['credit_permission','course_proposal','drive_key']) from public.study_hub_resources where id=resource), 'private fields leaked';
  select course_id into course from public.study_hub_resources where id=resource;
  assert (select code='COMP1001' from public.study_hub_courses where id=course), 'course not created';
  begin perform pg_temp.mutate(admin_id,'publish',revision,5); raise exception 'stale approval accepted'; exception when serialization_failure then null; end;
  result := pg_temp.mutate(editor_id,'revise',resource,2); revision := (result->>'id')::uuid;
  data := (data - 'course_proposal') || jsonb_build_object('course_id',course,'title','Revised arrays guide');
  perform pg_temp.mutate(editor_id,'save',revision,1,data);
  assert (select content->>'title'='Arrays guide' from public.study_hub_resources where id=resource), 'revision changed public data';
  perform pg_temp.mutate(editor_id,'submit',revision,2);
  perform pg_temp.mutate(editor_id,'withdraw',revision,3);
  perform pg_temp.mutate(editor_id,'submit',revision,4);
  perform pg_temp.mutate(admin_id,'publish',revision,5);
  perform pg_temp.mutate(admin_id,'archive',resource,3);
  assert (select status='archived' from public.study_hub_resources where id=resource), 'archive failed';
  perform pg_temp.mutate(admin_id,'restore',resource,4);
  assert (select status='published' from public.study_hub_resources where id=resource), 'restore failed';
  result := pg_temp.mutate(editor_id,'create',null,null,data);
  begin perform pg_temp.mutate(editor_id,'submit',(result->>'id')::uuid,1); raise exception 'duplicate Drive ID accepted'; exception when unique_violation then null; end;
  perform pg_temp.mutate(editor_id,'discard',(result->>'id')::uuid,1);
  result := pg_temp.mutate(editor_id,'create');
  begin perform pg_temp.mutate(editor_id,'submit',(result->>'id')::uuid,1); raise exception 'incomplete draft submitted'; exception when invalid_parameter_value then null; end;
  select count(*) into count_before from public.study_hub_courses;
  -- A conflicting course proposal cannot partially publish/create a duplicate course.
  data := (data - 'course_id') || jsonb_build_object('drive_key','another_drive_id',
    'drive_url','https://drive.google.com/file/d/another_drive_id/view',
    'course_proposal',jsonb_build_object('code','COMP1001','title','Wrong title','college_id','science'));
  perform pg_temp.mutate(editor_id,'save',(result->>'id')::uuid,1,data);
  perform pg_temp.mutate(editor_id,'submit',(result->>'id')::uuid,2);
  begin perform pg_temp.mutate(admin_id,'publish',(result->>'id')::uuid,3); raise exception 'existing course overwritten'; exception when unique_violation then null; end;
  assert (select count(*)=count_before from public.study_hub_courses), 'partial course creation';
  assert (select state='submitted' from public.study_hub_resource_revisions where id=(result->>'id')::uuid), 'partial publication';
  perform pg_temp.mutate(admin_id,'publish',(result->>'id')::uuid,3,jsonb_build_object('course_id',course));
  perform pg_temp.mutate(admin_id,'archive',(result->>'resource_id')::uuid,2);
  perform pg_temp.mutate(admin_id,'revoke_editor',editor_id);
  begin perform pg_temp.mutate(editor_id,'create'); raise exception 'revoked editor retained access'; exception when insufficient_privilege then null; end;
  begin perform pg_temp.mutate(admin_id,'semesters',null,1,'{"semesters":["Fall27"]}'); raise exception 'existing semesters removed'; exception when invalid_parameter_value then null; end;
  raise notice 'PASS: editorial transitions, revocation, duplicates, course matching, atomicity and stale versions';
end $$;
reset role;

set local role anon;
do $$
begin
  assert (select count(*)=1 from public.study_hub_resources where drive_key in ('test_drive_001','another_drive_id')), 'public sees archived resources';
  assert not exists(select 1 from public.study_hub_resources where status <> 'published'), 'public sees unpublished resources';
  begin perform 1 from public.study_hub_resource_revisions; raise exception 'public read private revisions'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.study_hub_editors; raise exception 'public read editors'; exception when insufficient_privilege then null; end;
  begin insert into public.study_hub_resources default values; raise exception 'public write allowed'; exception when insufficient_privilege then null; end;
  begin perform pg_temp.mutate('10000000-0000-0000-0000-000000000001','create'); raise exception 'public spoofed actor'; exception when insufficient_privilege then null; end;
  raise notice 'PASS: anonymous visibility and privilege boundaries';
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
do $$
begin
  assert (select count(*)=1 from public.study_hub_resources where drive_key in ('test_drive_001','another_drive_id')), 'member sees archived resources';
  assert not exists(select 1 from public.study_hub_resources where status <> 'published'), 'member sees unpublished resources';
  begin update public.study_hub_resources set status='archived'; raise exception 'member write allowed'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.study_hub_resource_revisions; raise exception 'member read private revisions'; exception when insufficient_privilege then null; end;
  begin insert into public.users(id,is_admin) values ('10000000-0000-0000-0000-000000000003',true); raise exception 'self promotion by insert'; exception when insufficient_privilege then null; end;
  insert into public.users(id,is_admin) values ('10000000-0000-0000-0000-000000000003',false);
  begin update public.users set is_admin=true where id='10000000-0000-0000-0000-000000000003'; raise exception 'self promotion by update'; exception when insufficient_privilege then null; end;
  update public.users set is_admin=false where id='10000000-0000-0000-0000-000000000003';
  raise notice 'PASS: authenticated boundaries and protected admin flag';
end $$;
reset role;
select pass('Study Hub workflow, role boundaries and admin-flag protection');
select * from finish();
rollback;

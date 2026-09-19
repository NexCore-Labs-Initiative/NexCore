-- Disposable local database only. All fixtures roll back.
begin;
insert into auth.users(id,email) values ('30000000-0000-0000-0000-000000000001','intake-admin@example.invalid');
insert into public.admins(email) values ('intake-admin@example.invalid');
set local role service_role;
do $$
declare
 actor uuid := '30000000-0000-0000-0000-000000000001'; email text := 'intake-admin@example.invalid';
 source jsonb; c jsonb; r jsonb; s public.study_hub_submissions; first_id uuid; draft_id uuid; rev_id uuid; n integer;
begin
 c := '{"title":"Reviewed title","description":"Approved description","semester":"Spring26","type":"Notes","format":"pdf","drive_url":"https://drive.google.com/file/d/intake_test1/view","drive_key":"intake_test1","topics":["Arrays"],"languages":["en","ar"],"credit":"","credit_permission":false,"course_proposal":{"code":"INTAKE1001","title":"Course","college_id":"science"}}';
 source := jsonb_build_object('external_response_id','30000000-0000-0000-0000-000000000010','submitted_at',now(),'submitter_name','PRIVATE NAME','submitter_note','PRIVATE NOTE','credit_consent',false,'terms_accepted',true,'source_content',c,'source_hash',repeat('a',64),'validation_issues','[]'::jsonb);
 begin perform public.study_hub_import_submission(actor,'editor@example.invalid','test',12,2,source); raise exception 'editor imported'; exception when insufficient_privilege then null; end;
 r:=public.study_hub_import_submission(actor,email,'test',12,2,source); assert r->>'result'='imported';
 r:=public.study_hub_import_submission(actor,email,'test',12,10,source); assert r->>'result'='already_synced';
 assert (select count(*)=1 from public.study_hub_submissions); select * into s from public.study_hub_submissions; first_id:=s.id;
 assert s.source_row_number=10;
 begin perform public.study_hub_review_submission(actor,'member@example.invalid','convert',s.id,1,'{}'); raise exception 'member converted'; exception when insufficient_privilege then null; end;
 perform public.study_hub_review_submission(actor,email,'save',s.id,1,jsonb_build_object('content',c||'{"title":"Admin correction"}','note','PRIVATE REVIEW'));
 begin perform public.study_hub_review_submission(actor,email,'save',s.id,1,'{}'); raise exception 'stale save'; exception when serialization_failure then null; end;
 r:=public.study_hub_import_submission(actor,email,'test',12,10,source||jsonb_build_object('source_hash',repeat('b',64),'source_content',c||'{"title":"Source edited"}'));
 assert r->>'result'='source_changed'; select * into s from public.study_hub_submissions where id=first_id;
 assert s.review_content->>'title'='Admin correction' and s.source_changed and s.version=3;
 begin perform public.study_hub_review_submission(actor,email,'convert',s.id,3,jsonb_build_object('content',c)); raise exception 'unacknowledged edit converted'; exception when invalid_parameter_value then null; end;
 begin perform public.study_hub_review_submission(actor,email,'convert',s.id,3,jsonb_build_object('content',c-'format','acknowledge_source',true)); raise exception 'invalid content converted'; exception when invalid_parameter_value then null; end;
 begin perform public.study_hub_review_submission(actor,email,'convert',s.id,3,jsonb_build_object('content',c||'{"credit":"PRIVATE NAME","credit_permission":true}','acknowledge_source',true)); raise exception 'credit without consent'; exception when invalid_parameter_value then null; end;
 r:=public.study_hub_review_submission(actor,email,'convert',s.id,3,jsonb_build_object('content',s.review_content||'{"submitter_note":"PRIVATE NOTE","source_id":"PRIVATE SOURCE"}','acknowledge_source',true));
 draft_id:=(r->>'resource_id')::uuid; rev_id:=(r->>'id')::uuid;
 assert (select status='draft' and content is null from public.study_hub_resources where id=draft_id);
 assert (select state='draft' and content->>'title'='Admin correction' and content::text not like '%PRIVATE%' from public.study_hub_resource_revisions where id=rev_id);
 assert (select status='converted' and revision_id=rev_id from public.study_hub_submissions where id=s.id);
 r:=public.study_hub_review_submission(actor,email,'convert',s.id,3,'{}'); assert (r->>'resource_id')::uuid=draft_id;
 assert (select count(*)=1 from public.study_hub_resources);
 r:=public.study_hub_import_submission(actor,email,'test',12,3,source||'{"external_response_id":"30000000-0000-0000-0000-000000000011"}');
 select * into s from public.study_hub_submissions where id<>first_id;
 r:=public.study_hub_review_submission(actor,email,'convert',s.id,1,jsonb_build_object('content',c)); assert (r->>'duplicate_resource_id')::uuid=draft_id;
 perform public.study_hub_review_submission(actor,email,'reject',s.id,1,'{"note":"Duplicate"}'); assert (select count(*)=1 from public.study_hub_resources);
 r:=public.study_hub_import_submission(actor,email,'test',12,3,source||jsonb_build_object('external_response_id','30000000-0000-0000-0000-000000000011','source_hash',repeat('c',64)));
 assert (select status='rejected' and source_changed from public.study_hub_submissions where id=s.id);
 perform public.study_hub_review_submission(actor,email,'reopen',s.id,3,'{}');
 perform public.study_hub_mutate(actor,'submit',rev_id,1,'{}',email);
 perform public.study_hub_mutate(actor,'publish',rev_id,2,'{}',email);
 assert (select content::text not like '%PRIVATE%' and status='published' from public.study_hub_resources where id=draft_id);
 r:=public.study_hub_import_submission(actor,email,'test',12,10,source||jsonb_build_object('source_hash',repeat('d',64)));
 assert (select status='converted' and source_changed from public.study_hub_submissions where id=first_id);
 assert (select content->>'title'='Admin correction' from public.study_hub_resources where id=draft_id);
 assert not has_table_privilege('anon','public.study_hub_submissions','SELECT');
 assert not has_table_privilege('authenticated','public.study_hub_submissions','SELECT');
 assert not has_table_privilege('authenticated','public.study_hub_submissions','INSERT');
 assert not has_function_privilege('authenticated','public.study_hub_review_submission(uuid,text,text,uuid,integer,jsonb)','EXECUTE');
end $$;
set local role anon;
do $$ begin
 begin perform * from public.study_hub_submissions; raise exception 'anonymous read'; exception when insufficient_privilege then null; end;
 assert (select count(*)=1 from public.study_hub_resources);
 assert not exists(select 1 from public.study_hub_resources where content::text like '%PRIVATE%');
end $$;
set local role authenticated;
do $$ begin
 begin perform * from public.study_hub_submissions; raise exception 'authenticated read'; exception when insufficient_privilege then null; end;
end $$;
rollback;

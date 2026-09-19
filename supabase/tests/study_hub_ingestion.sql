begin;
set local role service_role;
do $$
declare data jsonb; original public.study_hub_submissions; r jsonb;
begin
 data := '{"external_response_id":"40000000-0000-0000-0000-000000000009","submitted_at":"2026-09-01T00:00:00Z","submitter_name":"PRIVATE","submitter_note":"PRIVATE NOTE","credit_consent":false,"terms_accepted":true,"source_content":{"title":"Synthetic"},"validation_issues":["format"]}'::jsonb||jsonb_build_object('source_hash',repeat('a',64));
 r := public.study_hub_ingest_submission('synthetic_sheet',12,2,data); assert r->>'result'='imported';
 select * into strict original from public.study_hub_submissions where source_spreadsheet_id='synthetic_sheet';
 assert original.status='pending' and original.resource_id is null and not original.source_changed;
 r := public.study_hub_ingest_submission('synthetic_sheet',12,22,data); assert r->>'result'='already_synced';
 assert (select count(*)=1 from public.study_hub_submissions where source_spreadsheet_id='synthetic_sheet');
 r := public.study_hub_ingest_submission('synthetic_sheet',12,22,data||jsonb_build_object('source_hash',repeat('b',64),'source_content','{"title":"changed"}'::jsonb));
 assert r->>'result'='source_conflict';
 assert (select row_to_json(s)::jsonb=to_jsonb(original) from public.study_hub_submissions s where id=original.id);
 assert (select count(*)=0 from public.study_hub_resources);
 assert not has_function_privilege('anon','public.study_hub_ingest_submission(text,bigint,integer,jsonb)','EXECUTE');
 assert not has_function_privilege('authenticated','public.study_hub_ingest_submission(text,bigint,integer,jsonb)','EXECUTE');
 assert not has_table_privilege('anon','public.study_hub_submissions','SELECT');
 assert not has_table_privilege('authenticated','public.study_hub_submissions','SELECT,INSERT,UPDATE');
end $$;
set local role authenticated;
do $$ begin
 begin perform public.study_hub_ingest_submission('synthetic_sheet',12,2,'{}'); raise exception 'browser role ingested'; exception when insufficient_privilege then null; end;
end $$;
rollback;

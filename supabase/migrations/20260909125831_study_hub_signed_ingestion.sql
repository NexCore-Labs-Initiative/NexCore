begin;
-- Machine ingestion cannot invoke review/publication or impersonate an administrator.
-- Existing rows, UUIDs and legacy source-change history stay intact.
create function public.study_hub_ingest_submission(p_source text,p_sheet bigint,p_row integer,p_data jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.study_hub_submissions; inserted_id uuid;
begin
 if p_source is null or length(p_source) not between 10 and 100 or p_sheet is null or p_sheet<0
 or p_row is null or p_row not between 2 and 50000 or jsonb_typeof(p_data->'source_content') is distinct from 'object'
 or jsonb_typeof(p_data->'validation_issues') is distinct from 'array' then
  raise exception 'invalid_ingestion' using errcode='22023';
 end if;
 insert into public.study_hub_submissions(source_spreadsheet_id,source_sheet_id,external_response_id,source_row_number,
 submitted_at,submitter_name,submitter_note,credit_consent,terms_accepted,source_content,source_hash,review_content,validation_issues)
 values(p_source,p_sheet,(p_data->>'external_response_id')::uuid,p_row,(p_data->>'submitted_at')::timestamptz,
 p_data->>'submitter_name',p_data->>'submitter_note',(p_data->>'credit_consent')::boolean,(p_data->>'terms_accepted')::boolean,
 p_data->'source_content',p_data->>'source_hash',p_data->'source_content',p_data->'validation_issues')
 on conflict(source_spreadsheet_id,source_sheet_id,external_response_id) do nothing returning id into inserted_id;
 if inserted_id is not null then return jsonb_build_object('result','imported'); end if;
 select * into strict s from public.study_hub_submissions where source_spreadsheet_id=p_source and source_sheet_id=p_sheet
 and external_response_id=(p_data->>'external_response_id')::uuid for update;
 if s.source_hash=p_data->>'source_hash' then return jsonb_build_object('result','already_synced'); end if;
 -- Immutable intake: never overwrite source, corrections, review state or resources.
 return jsonb_build_object('result','source_conflict');
end $$;
revoke all on function public.study_hub_ingest_submission(text,bigint,integer,jsonb) from public,anon,authenticated;
grant execute on function public.study_hub_ingest_submission(text,bigint,integer,jsonb) to service_role;
commit;

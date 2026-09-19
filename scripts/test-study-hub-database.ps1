$ErrorActionPreference = 'Stop'
$testContainer = 'nexcore-study-hub-test'
$testDatabaseName = 'study_hub_verify_' + [Guid]::NewGuid().ToString('N')
$repoRoot = Split-Path -Parent $PSScriptRoot

# A fresh database inside the explicitly named disposable local container.
# The bootstrap models only the Labs identity/profile contract, not its entire schema.
& docker exec $testContainer createdb -U postgres $testDatabaseName
if ($LASTEXITCODE -ne 0) { throw 'Start the disposable nexcore-study-hub-test PostgreSQL container first.' }
try {
    @'
create schema auth;
create schema extensions;
create table auth.users(id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to anon,authenticated,service_role;
create table public.admins(id uuid primary key default gen_random_uuid(), email text not null unique);
create table public.users(id uuid primary key references auth.users(id), is_admin boolean not null default false);
alter table public.users enable row level security;
grant all on public.users to anon,authenticated,service_role;
grant all on public.admins to service_role;
create policy users_own on public.users to authenticated using (auth.uid()=id) with check (auth.uid()=id);
'@ | & docker exec -i $testContainer psql -U postgres -d $testDatabaseName -v ON_ERROR_STOP=1 -q
    if ($LASTEXITCODE -ne 0) { throw 'Test identity bootstrap failed.' }
    foreach ($relative in @(
        'supabase/migrations/20260908144121_study_hub_editorial_workflow.sql',
        'supabase/migrations/20260908144729_protect_user_admin_flag.sql',
        'supabase/migrations/20260909045257_study_hub_submissions.sql',
        'supabase/migrations/20260909125831_study_hub_signed_ingestion.sql',
        'supabase/tests/study_hub_ingestion.sql',
        'supabase/tests/study_hub.sql',
        'supabase/tests/study_hub_submissions.sql'
    )) {
        Get-Content -Raw (Join-Path $repoRoot $relative) | & docker exec -i $testContainer psql -U postgres -d $testDatabaseName -v ON_ERROR_STOP=1 -q
        if ($LASTEXITCODE -ne 0) { throw "Database check failed: $relative" }
    }
} finally {
    # This name is generated above and cannot identify the browser fixture database.
    if ($testDatabaseName -notmatch '^study_hub_verify_[a-f0-9]{32}$') { throw 'Unsafe test database name.' }
    & docker exec $testContainer dropdb -U postgres $testDatabaseName
}

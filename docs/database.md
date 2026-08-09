# Database security and deployment

`supabase/migrations/` is the only executable schema source of truth. Files under `docs/archive/sql/` are historical references and must never be applied as migrations.

## v3.3 rollout record

The compatible frontend and APIs were deployed, and the restrictive v3.3 SQL was applied to production on 2026-08-08. The reviewed SQL is archived at `docs/archive/sql/20260808125353_v3_3_trust_foundations.applied.sql`; it is historical evidence and must not be executed again.

Use `docs/database-access-matrix.md` for access verification and `database-rollback.md` for recovery. The service-role key must not appear in browser bundles, logs, screenshots, issues, or migration files.

## Baseline status

The production project is `qacupmuqeuqspfhwosfu`. Historical marker migrations record changes that predate repository-owned schema management. `20260809082345_production_schema_baseline.sql` is a schema-only dump of the reviewed post-v3.3 production database and is the canonical definition for fresh environments. It contains no production rows or secrets.

To verify from an empty local database:

```powershell
npx.cmd supabase start
npx.cmd supabase db reset --local --no-seed
npx.cmd supabase migration list --local
```

After changing schema, create a new migration with `npx.cmd supabase migration new <name>`. Do not edit the baseline or historical marker files.

## Security Advisor review — 2026-08-09

Production and the migration-built local database both report zero error-level findings. The 15 production warnings were reviewed as follows:

- Four mutable `search_path` warnings affect non-privileged trigger/default helpers. They are not browser-executable after v3.3 grants, but fixed paths should be added in a follow-up migration.
- `vector` remains in `public` because the production knowledge schema and `search_knowledge(public.vector, integer)` signature depend on that location. Moving it requires a coordinated type/function migration and is deferred while Intelligence is paused.
- `submit_anon_suggestion` and `toggle_anon_vote` are deliberately anonymous `security definer` interfaces. v3.3 constrains their inputs, fixes their search paths, limits their grants to `anon` and `service_role`, and prevents direct mutation of their protected records.
- Seven authenticated `security definer` functions are intentional application RPCs. Their grants and identity/admin checks must be retested whenever their implementations change; the paused AI usage RPCs remain follow-up cleanup candidates.
- Leaked-password protection remains disabled and must be enabled in Supabase Auth settings. NexCore currently signs users in through Google OAuth, but this warning is not considered resolved until the dashboard setting is enabled.

Re-run `npx.cmd supabase db advisors --linked --type security --level warn --fail-on none` after each production database change and update this review when the warning set changes.

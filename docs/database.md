# Database security and deployment

`supabase/migrations/` is the only executable schema source of truth. Files under `docs/archive/sql/` are historical references and must never be applied as migrations.

## v3.3 rollout order

1. Confirm a current Supabase backup and record its restore path.
2. Deploy the compatible frontend and APIs (`/api/public-metrics`, `/api/admin/access`, one-argument voting RPC client).
3. Smoke-test the compatible deployment while legacy grants still exist.
4. Apply `20260808125353_v3_3_trust_foundations.sql` immediately afterward.
5. Test anonymous, member, admin, and service-role access using `docs/database-access-matrix.md`.
6. Run the Supabase security advisor. Errors must be zero; warnings must be reviewed and recorded.
7. If any access boundary fails, execute the rollback procedure in `database-rollback.md`.

Never apply the restrictive migration before step 2. The service-role key must not appear in browser bundles, logs, screenshots, issues, or migration files.

## Baseline status

The production project is `qacupmuqeuqspfhwosfu`. The production migration ledger is represented by historical marker files, but those markers are not a complete schema baseline. Both `supabase db pull` and `supabase db dump` reached the linked project and then stopped because Docker Desktop/shadow tooling is unavailable locally. This also causes fresh Supabase preview branches to fail before v3.3 because production tables do not yet exist there. Do not substitute a guessed schema or conditional no-op migration: capture and review the real schema from a Docker-capable environment, reconcile its production migration-history entry deliberately, and rerun the preview from a fresh branch.

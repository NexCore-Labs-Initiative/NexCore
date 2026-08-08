# Database security and deployment

`supabase/migrations/` is the only executable schema source of truth. Files under `docs/archive/sql/` are historical references and must never be applied as migrations.

## v3.3 rollout order

1. Confirm a current Supabase backup and record its restore path.
2. Deploy the compatible frontend and APIs (`/api/public-metrics`, `/api/admin/access`, one-argument voting RPC client).
3. Smoke-test the compatible deployment while legacy grants still exist.
4. Apply `20260808110057_v3_3_trust_foundations.sql` immediately afterward.
5. Test anonymous, member, admin, and service-role access using `docs/database-access-matrix.md`.
6. Run the Supabase security advisor. Errors must be zero; warnings must be reviewed and recorded.
7. If any access boundary fails, execute the rollback procedure in `database-rollback.md`.

Never apply the restrictive migration before step 2. The service-role key must not appear in browser bundles, logs, screenshots, issues, or migration files.

## Baseline status

The production project is `qacupmuqeuqspfhwosfu`. A CLI baseline pull must be reviewed before production application. If the network cannot reach the Supabase pooler, do not substitute a guessed schema; retain the release gate and retry from an IPv4-capable connection.

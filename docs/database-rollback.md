# Database rollback

## Before migration

- Confirm the latest backup timestamp in Supabase.
- Export migration history and advisor results.
- Record counts, not rows, for protected tables.
- Confirm the previous compatible Vercel deployment is available for rollback.

## Rollback triggers

Rollback immediately if public pages cannot load required records, authenticated members cannot vote for themselves, admins cannot use `/api/admin/access`, newsletter writes fail, or advisor errors increase.

## Procedure

1. Stop rollout traffic by restoring the previous Vercel deployment if the frontend/API is the failure.
2. Restore the pre-migration database backup for broad or uncertain failure.
3. For a verified grant-only failure, use a separately reviewed compensating migration; never edit migration history or manually re-enable broad public policies.
4. Re-run the full access matrix and advisor checks.
5. Document the incident, affected interval, rollback evidence, and follow-up issue.

The v3.3 restrictive migration intentionally has no automatic down migration because restoring insecure public enumeration would recreate the original vulnerability.

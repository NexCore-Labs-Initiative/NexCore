# Architecture

NexCore Labs is a bilingual static multi-page application hosted on Vercel. The flat HTML architecture is deliberate for v3.3; this release stabilizes it instead of migrating frameworks.

## Boundaries

- Public pages may use the Supabase Data API only for deliberately public records protected by RLS.
- Sensitive lists, analytics tables, newsletter records, moderation data, counters, and paused orders are server-owned.
- `api/public-metrics.js` exposes aggregate counts, not raw analytics rows.
- `api/admin/access.js` validates a bearer token, verifies the administrator against the server-owned list, and performs approved-user/admin mutations with the service role.
- `lib/api/` standardizes authentication, validation, safe JSON errors, basic rate limiting, and structured logs.

## Shared static shell

`scripts/sync-shared-shell.js` maintains accessibility-critical shell invariants across English and Arabic HTML: real menu buttons, `aria-expanded`, skip links, main targets, navigation landmarks, and non-heading logo text. The script also removes paused product links from primary navigation. Run it after editing page chrome.

`config/routes.json` is the canonical route registry consumed by route validation. It records locale pairs, source files, indexability, PWA precaching, and sitemap priority.

## Future extraction

Large inline page modules should move into focused files without changing behavior, starting with admin access, dashboard/account, project display, and the paused pricing/Intelligence pages. This is maintenance work, not a framework migration.

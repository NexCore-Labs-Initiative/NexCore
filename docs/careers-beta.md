# Careers Beta

The paired static pages `/careers` and `/ar/careers` contain two volunteer roles,
native expandable details, and a shared vanilla JavaScript application form.
Role hours are agreed with applicants; no salary or fixed time commitment is promised.

`POST /api/career-applications` reuses the existing server-only Supabase client,
HTTP helpers, and rate limiter. It validates and allowlists fields, requires consent,
accepts SQU email domains, and returns only a success flag or generic error code.
An SQU address is checked for format, not verified ownership. The form does not
save personal data to browser storage. It preserves answers in memory on failure.

Apply `supabase/migrations/20260907192444_create_career_applications.sql` through
the normal database deployment workflow before releasing the pages. The existing
Vercel `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are required. RLS is enabled
and all access for `PUBLIC`, `anon`, and `authenticated` is revoked. There are no
public policies, read endpoints, or applicant listing UI. Authorized database
administrators review submissions directly. Set an operational retention/deletion
schedule for applications before launch.

Checks: `node scripts/careers-test.js`, `npm run browser:test -- tests/browser/careers.spec.js`,
and `supabase test db` for the database assertions once a local stack is running.
Browser tests mock the POST endpoint; they do not prove delivery to Supabase.
The existing in-memory rate limiter is per server instance, not a distributed
abuse-prevention service. No new dependencies are required by Careers.

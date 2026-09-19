# Study Hub editorial management

## Ownership and boundaries

NexCore Labs owns sign-in, the administrator directory, the `/study-hub-admin` and `/ar/study-hub-admin` pages, the protected `/api/admin/study-hub` endpoint, and the shared project's migration history. Study Hub owns its public catalogue adapter and renderer. No user profiles, authentication implementation, or migration history are duplicated.

Study Hub's public frontend uses native fetch and the existing public Supabase key. Its only public database access is SELECT of published resource metadata, courses, colleges and settings. Draft content, Editor membership, actor IDs, permissions and review notes are service-only. Google Form responses are delivered by a signed Apps Script POST into an admin-only submission queue. Review and publication remain manual; files stay on Google Drive and no Storage bucket is introduced.

## Team workflow

1. A Labs admin opens the dedicated workspace from the admin panel/account menu and grants Editor access using an existing user's email. It grants Study Hub editorial access only, not general Labs administration.
2. Editors share the queue. Save incomplete drafts, add a course proposal if needed, and use the card preview. All required metadata and sharing-credit permission must be present before submission.
3. Submit for review locks the draft. An editor can withdraw it. An admin can return it with a note or approve it after checking the Drive viewer link, rights, content and proposed course. A new course may instead be matched to an existing course during publication.
4. A revision to a published resource leaves the approved copy public. Publication is one database transaction and records the actor, time and workflow history.
5. Resolve a working revision before archiving. Archive/restore are admin-only. Discard closes a draft without deleting audit history. Hard deletion is deliberately absent.

Each resource has a stable UUID and UUID-based slug. One active revision is allowed. Version conflicts leave unsaved fields available to copy before reopening the current version. The normalized Drive ID is unique across published/archived resources and submitted revisions. Similar title/course/semester combinations show a warning; titles are not unique.

Title, description, topics, course, semester, type, format, at least one language, and a valid Drive URL are required for review. Public credit and reviewed translations are optional. Language values are `ar` and `en`; both may be selected. The ordered semester seed follows the supplied list exactly (including the absence of Fall26). Admins can extend/reorder the list while retaining existing values. Formats and resource types are migration-controlled; Study plan is included.

## API and database

The five `/api/admin/*` URLs share one Vercel entry point, `api/admin/[route].js`, with their original implementations in `lib/admin-handlers/`. Dispatch uses the request path and a fixed allowlist; each handler retains its own authorization and method checks. Ingestion remains a separate HMAC-protected function. This packages Labs as 11 functions, within the Hobby plan's 12-function limit, without changing frontend URLs. `tests/admin-router.test.cjs` checks routing, authorization rejection, and the function-count budget. Any future rebuild of the reduced staging artifact must include this dispatcher and its handler dependencies; the historical staging artifact predates this packaging change.

GET `/api/admin/study-hub` returns capabilities and metadata. `kind=resources|revisions|courses&offset=N` provides the shared queue in pages of 100. `kind=detail&id=UUID` returns a resource and its most recent 100 revisions; `kind=editors` is admin-only. This first release does not promise an unlimited history browser.

POST accepts `{ action, id, version, payload }`. Actions: `create`, `save`, `submit`, `withdraw`, `return`, `publish`, `discard`, `revise`, `archive`, `restore`, `grant_editor`, `revoke_editor`, `semesters`. The API derives actor UUID/email from `auth.getUser(token)`, ignores client-supplied identity/role flags, checks live membership, and calls the service-only `study_hub_mutate` transaction. Its identity arguments are trusted server input, never a browser RPC contract. Direct RPC execution is revoked from PUBLIC, anon and authenticated. Database functions use SECURITY INVOKER and a fixed search path.

`study_hub_resources.content` contains approved display fields only, with a course FK alongside it. Private working data and history are in `study_hub_resource_revisions`. Explicit RLS/grants protect all six new tables. Service-role credentials remain in the existing server environment. HTTP responses and management routes are excluded from persistent caching. Existing Labs administrator membership in `admins` remains authoritative for this feature.

The separate `protect_user_admin_flag` migration blocks browser-role insertion of a true `users.is_admin` flag and changes to that flag. Ordinary profile edits and server administration remain supported. Read-only inspection on 2026-09-08 confirmed the existing live column grants and owner-row policies did not protect this flag; do not enable the feature until the guard is deployed and verified. This does not attempt to reconcile the legacy UI role flag with the administrator directory.

## Local setup

Run `vercel dev` from this Labs worktree to serve the pages and API together. A static file server cannot run `/api/admin/study-hub`.

The worktree's ignored `.env` must contain `SUPABASE_URL`, `SUPABASE_ANON_KEY` (or `SUPABASE_PUBLISHABLE_KEY`), and `SUPABASE_SERVICE_ROLE_KEY` for the same Supabase project. Worktrees do not inherit the original checkout's ignored environment files, and a Vercel environment pull may omit keys that are not configured for Development. For this static project, Vercel CLI 59.11.7 loads API environment overrides from `.env`; its downloaded `.env.local` alone is insufficient. If you create `.env`, include every server variable needed locally, since this CLI uses local overrides instead of its downloaded environment. Restart `vercel dev` after changing these values. Keep the service-role key exclusively in server environment configuration.

After applying the migrations, open `http://localhost:3000/study-hub-admin.html` and sign in with an existing Labs administrator or Study Hub Editor account. If the workspace is unavailable, check the local API response and server environment before reapplying migrations. Without a bearer token the API should return HTTP 401; a signed-in request still needs the server credential to read the editorial tables.

## Verification

### Google Form intake: signed Apps Script delivery (V1)

Google Form → Restricted response Sheet → standalone Apps Script installable trigger → `POST /api/integrations/study-hub-ingest` in Labs → private submissions → administrator review → resource draft → existing submit/review/publication workflow. No service-account keys, Sheets API reader, public Sheet, cron on Vercel, uploads or new administrator login are required. Keep `iam.disableServiceAccountKeyCreation` in force.

The public Form was fetched read-only on 2026-09-09, but its public page does not authoritatively expose whether response editing is enabled. We did not submit a test response to the real Form or access production student rows. V1 assumes immutable responses. **Setup reads the actual setting with `FormApp.getAllowResponseEdits()` and stops with `editable_responses_require_review` if true.** It never changes that setting. If this happens, stop setup and review the editable-response requirement; do not silently disable the Form setting or invent new UUIDs for changed deliveries.

#### Manual database migration

Apply the following migrations in order, skipping those already recorded as applied:

1. `20260908144121_study_hub_editorial_workflow.sql`
2. `20260908144729_protect_user_admin_flag.sql`
3. `20260909045257_study_hub_submissions.sql`
4. **New for signed ingestion:** `20260909125831_study_hub_signed_ingestion.sql`

The new migration adds `study_hub_ingest_submission(text,bigint,integer,jsonb)`, a `SECURITY INVOKER` function with a fixed search path and EXECUTE granted only to `service_role`. It inserts pending submissions only; it accepts no actor, status, review notes or resource action. The endpoint authenticates the machine with HMAC before invoking it. Existing `authenticateAdmin()` / `public.admins` checks still control human review. Ordinary authenticated users and Study Hub Editors cannot access intake.

No source/content version columns or reconciliation tables are added. Existing source-change history from the old pull implementation is retained for compatibility; new push requests cannot overwrite it. An identical existing source hash receives `already_synced`; a changed payload under the same UUID receives HTTP 409 `source_conflict`. Review state, corrections and resources remain untouched. Spreadsheet ID + numeric tab ID + UUID remains the unique database key. Moving a whole row does not change identity. Different submissions with the same Drive file still reach existing duplicate checks before conversion.

Apply only these named pending migrations to the intended environment; do not batch-apply unrelated migrations or rerun already applied SQL. Test SQL contains synthetic identities and is for disposable databases only.

#### Server-only variables (Labs / Vercel)

| Variable | Value |
| --- | --- |
| `STUDY_HUB_INGEST_SECRET` | Exactly 64 hexadecimal characters generated from 32 cryptographically random bytes. Separate secret per environment. |
| `STUDY_HUB_INGEST_ENABLED` | Exactly `true` permits imports. Defaults disabled. Signed header-only connection tests still work while disabled. |
| `STUDY_HUB_GOOGLE_SPREADSHEET_ID` | Response spreadsheet ID. Production target: `1YsfWTGcSeph96JhThKurRAb5Hx6f6yhr_h6Q6FM09zo`. |
| `STUDY_HUB_GOOGLE_SHEET_ID` | Numeric response tab ID. Production target: `175028121`, currently `Form Responses 1`. |
| Existing Labs variables | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEY` for administrator sign-in. |

The secret is interpreted as the same UTF-8 hexadecimal string on both sides, not decoded into bytes for HMAC. Generate it on your own machine, for example with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`; paste it directly into the two secret stores. Do not paste it into chat, commit it, store it in Sheet cells, or put it in any browser/public environment variable. Script editors can access Script Properties; limit editing to trusted operators.

Remove the obsolete `STUDY_HUB_GOOGLE_SERVICE_ACCOUNT_JSON` and `STUDY_HUB_GOOGLE_SYNC_ENABLED` variables manually if previously configured. The key-based reader has been removed; the old protected sync route now returns HTTP 410 `google_pull_retired`. `google-auth-library` is no longer a direct intake dependency (Gemini may retain its own transitive dependency).

#### Apps Script setup (perform on the synthetic staging Sheet first)

1. Keep the response Sheet **Restricted**. Open [Apps Script](https://script.google.com/) directly and create a **standalone New project** under the maintained NexCore account. Do not use Sheet → Extensions. The operator needs access to the response spreadsheet and linked Form. Restrict script-project editing separately from Sheet editing, because script editors can access Script Properties.
2. Paste the full contents of `scripts/study-hub-response-ids.gs` into the standalone project's editor and save. Use the V8 runtime. No web-app publishing/deployment is needed. Use one active intake script project per response spreadsheet: script locks coordinate executions within that project, not across separate projects.
3. Under **Project Settings → Script Properties**, set:
   - `STUDY_HUB_GOOGLE_SPREADSHEET_ID`: the response spreadsheet's ID.
   - `STUDY_HUB_GOOGLE_SHEET_ID`: the response tab's numeric `gid` (not its name).
   - `STUDY_HUB_INGEST_URL`: `https://YOUR-LABS-HOST/api/integrations/study-hub-ingest` (exact HTTPS endpoint, no query string or redirect).
   - `STUDY_HUB_INGEST_SECRET`: same secret as the corresponding Labs environment.
   - For an approved protected Preview only: `STUDY_HUB_VERCEL_BYPASS_SECRET` and `STUDY_HUB_VERCEL_BYPASS_HOST`, as described below. Leave both absent when deployment protection does not require them.
4. Before replacing an older intake project, pause its triggers and keep backend intake disabled during setup. Use the Apps Script dashboard's **My Triggers** page to remove old `stampStudyHubId`, `onStudyHubFormSubmit`, and retry triggers belonging to the previous project. Other owners must remove their own triggers. Retain every existing UUID and delivery status in the Sheet.
5. With backend intake disabled, run `testStudyHubConnection` first. Expect `{result:"ready",enabled:false}`. This preflight works before setup: it reads only row 1, validates the mapped Form headers, and sends a signed header-only request. If the operational ID column is absent, its contract name is added only to the check payload. No response rows are read, Sheet cells changed, triggers installed, or setup approval granted. When ready to configure delivery on a synthetic Sheet, select `setupStudyHubIntake` and click **Run**, then authorize it. Setup uses `SpreadsheetApp.openById(...)`, resolves the numeric tab ID, checks the linked Form's editing setting and mapped headers, creates the ID/status columns if absent, and validates existing IDs. It then installs `onStudyHubFormSubmit` explicitly against the configured spreadsheet and a five-minute `retryStudyHubAutomatically` trigger. Setup itself imports no submissions; installed triggers attempt delivery and the disabled backend refuses imports. A failed setup leaves delivery blocked.
6. Setup is safe to rerun as the same owner: it reuses the matching triggers and removes duplicate/stale intake triggers visible in this project. It preserves unrelated triggers. Google does not expose another project's or another owner's triggers to this cleanup, so the previous step is still required when moving projects. In the standalone project's **Triggers** page, verify one spreadsheet form-submit trigger and one clock retry trigger; do not manually add duplicates.
7. Run `testStudyHubConnection` again if endpoint configuration or Form headers changed. A successful check verifies header compatibility and transport authentication, not the linked Form's editing setting, delivery triggers, or database. Enable backend intake only when separately authorized and the isolated test database is ready, then test a synthetic response against the staging Form/Sheet. Confirm UUID, `delivered`, and a private pending item in Labs.
8. Run `backfillStudyHubResponses` from the editor for existing responses, and `retryPendingStudyHub` for recovery after correcting failures. Backfill stamps only missing UUIDs and sends up to 25 pending rows per run. Repeat while `remaining` is nonzero or let the retry trigger continue. Manual retry includes permanent errors. Read summaries in the execution log / `STUDY_HUB_LAST_RESULT` and per-row results in **NexCore Delivery Status**. There is no custom Sheet menu or `onOpen` requirement.

Never replace a stamped UUID. Protect the two operational columns, use filter views, and do not sort only part of a response row. Do not edit already delivered source responses in V1; make editorial corrections in Labs. Acknowledged rows are not rescanned for changes. If an already-imported row is resent after editing, a content conflict is visible rather than overwriting the imported snapshot. Do not clear its UUID to bypass the conflict.

Installable triggers run as their creator. Keep access and trigger ownership maintained; if that account loses access, have the previous owner remove its triggers where possible and rerun setup as the replacement owner. Setup cannot discover triggers owned by other accounts. Google-side authorization/execution failures appear in Apps Script Executions and trigger failure notifications. Script/API-created rows do not invoke the form-submit trigger; backfill/retry handles those rows.

#### Protected Preview machine access

The sender supports two independent authentication layers: the `x-vercel-protection-bypass` HTTP header admits the request through Vercel Deployment Protection; the existing signed JSON envelope authenticates ingestion inside Labs. Neither replaces the other. Keep `STUDY_HUB_INGEST_ENABLED=false` during connection testing.

**Scope limitation:** [Vercel Protection Bypass for Automation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation) is available on all plans, but each automation secret grants bypass access to **all deployments in its project**, including protected production deployment URLs. The supported creation API has no Preview-only or route-only scope. A descriptive name or a Preview-only environment variable does not narrow this authority. If production access must remain untouched, do not create a new project automation secret without approval of that scope. An isolated staging project with its own test database and credentials is the alternative for a strict boundary; do not create it or relax protection implicitly.

After the scope is approved:

1. In Labs **Settings → Deployment Protection → Protection Bypass for Automation**, create a separate secret labelled for Study Hub Apps Script. Preserve Vercel Authentication, existing bypass secrets, and the existing secret selected for `VERCEL_AUTOMATION_BYPASS_SECRET`. Do not reuse the ingestion HMAC secret. Keep the new value only in Vercel's protection secret store and trusted Apps Script Properties; never copy it into source, chat, Sheet cells, logs, query strings, or public configuration.
2. Replace the standalone project's script with the current `scripts/study-hub-response-ids.gs` and save; no web-app deployment is required. In Script Properties add `STUDY_HUB_VERCEL_BYPASS_SECRET` with that value and `STUDY_HUB_VERCEL_BYPASS_HOST` with the exact approved Preview hostname (no scheme, slash, or path). Keep `STUDY_HUB_INGEST_URL` on that same host and preserve the separate `STUDY_HUB_INGEST_SECRET`.
3. The sender attaches the bypass only as an HTTP header. Host mismatch, malformed credentials, or reuse of the HMAC secret stops the request with `vercel_bypass_configuration_invalid`. Redirects remain disabled and no bypass cookie is requested. This host check prevents accidental transmission to a changed URL; it does **not** narrow the token's Vercel-side project-wide authority.
4. Run only `testStudyHubConnection` for this setup; setup verification is not required for this read-only preflight. Expect `{result:"ready",enabled:false}`. Do not run setup, backfill, retry, or submit the real Form just to test the header. The header-only check writes no submissions and reads no student response rows. Delivery functions still require successful setup verification. A bare request remains blocked by Vercel; bypass without valid HMAC returns `ingest_unauthorized`; both credentials produce the ready response. `http_401` can indicate Vercel rejected the bypass; `ingest_unauthorized` indicates the request reached Labs but its HMAC failed.
5. Revoke this dedicated bypass when Preview testing finishes. Rotate it independently of the ingestion HMAC secret. Remove both optional Script Properties when moving to an endpoint that needs no Vercel bypass. Do not send this credential to the public Study Hub or add it to frontend environment variables.

#### Dedicated staging deployment (2026-09-10)

The separate Vercel project is **`nexcore-study-hub-staging`**, in the existing NexCore team. Its automation credential is labelled **Study Hub Apps Script staging only**. It grants no bypass access to the main `nexcorelabs` project. Vercel Authentication remains enabled. The deployment is a Preview, with no Git connection, production deployment, or production environment variables in this staging project.

- Staging URL: `https://nexcore-study-hub-staging-7ay0vqag3.vercel.app`
- `STUDY_HUB_INGEST_URL`: `https://nexcore-study-hub-staging-7ay0vqag3.vercel.app/api/integrations/study-hub-ingest`
- `STUDY_HUB_VERCEL_BYPASS_HOST`: `nexcore-study-hub-staging-7ay0vqag3.vercel.app`
- Copy `STUDY_HUB_VERCEL_BYPASS_SECRET` from this staging project's **Settings → Deployment Protection → Protection Bypass for Automation**, using the dedicated credential above.
- Replace Apps Script's `STUDY_HUB_INGEST_SECRET` with the fresh value from this staging project's **Settings → Environment Variables → Preview**. Do not reuse either the exposed original secret or the main Labs Preview secret. The Vercel bypass and HMAC are different credentials.

Paste the latest `scripts/study-hub-response-ids.gs` into the existing standalone Google project and save. Set the properties above; leave the spreadsheet/tab properties unchanged for header-only connection checks. Run **only `testStudyHubConnection`** and expect `{result:"ready",enabled:false}`, even before setup. No web-app deployment or new triggers are needed for this compatibility update. Do not backfill, retry, or enable ingestion for this setup.

Only the Study Hub workspace, two API functions, their server dependencies, and required assets are deployed. The artifact lives under the ignored `.vercel/study-hub-staging-source/` and has its own Vercel project link. The worktree root remains linked to the main Labs project: do not deploy the staging setup from that root. The original management/API files and public Study Hub runtime are unchanged by artifact preparation.

**Database-backed staging is deferred by the owner (2026-09-18).** The owner will perform database testing separately later; no further Supabase project creation or database tests are part of this setup. No production Supabase variables were copied into staging. The staging browser client is deliberately disabled, with a visible notice, so resource-management sign-in and database actions remain unavailable there. Header-only ingestion connection checks work without a database. If database-backed staging is requested later, use an isolated test project, apply the documented migrations there, configure staging Preview `SUPABASE_URL`, `SUPABASE_ANON_KEY` (or `SUPABASE_PUBLISHABLE_KEY`) and `SUPABASE_SERVICE_ROLE_KEY`, and connect the artifact's browser client to that test project using only its public key. Configure test sign-in/admin membership separately. Intake remains disabled; production configuration and database operations were not authorized by this deferral.

Live staging checks passed again on **2026-09-17**: no bypass → Vercel 401; bypass alone → Labs 401 `ingest_unauthorized`; bypass plus HMAC → HTTP 200 `ready`, `enabled:false`. The existing standalone Google project also completed `testStudyHubConnection` with the same ready/disabled result after correcting its bypass hostname and applying the pre-setup header-only check. This verifies the actual private Sheet's header compatibility and Google-to-staging authentication without transmitting responses. It does not verify trigger delivery, the Form's response-edit setting, or a test database. No setup/backfill/retry was run; no ingestion was enabled.

The attempted isolated Supabase project creation in the approved NexCore organization was refused on **2026-09-17** because an organization owner already has two active free projects. No project was created, paused, deleted, or upgraded. The quoted project cost was $0/month; no paid upgrade was authorized. This attempt is closed following the owner's decision to defer database-backed staging.

Vercel classified the initial staging deployment as Production despite the Preview flag. That deployment was deleted; only the corrected Preview remains. Verify the returned target on future deployments rather than relying on the CLI flag alone. The main Labs project, its protection/bypass configuration, and all its environment variables were verified unchanged.

#### Delivery, mapping and recovery

Requests use a JSON envelope `{version:1,timestamp,payload,signature}`. `timestamp` is Unix seconds as a string; `payload` is the exact JSON string. HMAC-SHA256 covers `v1\n` + timestamp + `\n` + payload. Labs requires HTTPS in the producer, checks the signature in constant time, and rejects requests outside a five-minute window. Retries sign a fresh timestamp with the same submission UUID. Database uniqueness handles concurrent deliveries and a lost successful response. The secret grants ingestion only; it is not a Supabase key or a user session.

The endpoint accepts POST/JSON only, caps the envelope at 64 KB, restricts spreadsheet/tab identity, validates fields server-side, and emits only fixed errors and safe acknowledgment metadata. No CORS permission is required for this server-to-server request. Service-worker and HTTP caching exclude private API data. Google response bodies and student values are not logged by the script or endpoint.

`lib/study-hub-intake.js` holds the expected header mapping. The script includes matching aliases, checked by an automated contract test. Required headers are:

`NexCore Submission ID`, `Timestamp`, `Your Name`, `Course code`, `Course title`, `Semester`, `Resource title`, `Resource type`, `Main topics`, `Google Drive link`, `Description`, `Want your name to appear for others once your file got included in NexCore Study Hub website?`, `Contribution Terms`.

Optional: `Notes for reviewers`, `Resource format`, `Resource language`. Unicode/whitespace normalization and explicit bilingual aliases are supported; missing/ambiguous required headers stop delivery. Unknown columns, SQU IDs and email values are discarded before transmission. Keep header changes explicit and update both mapping copies plus tests.

`Book` → `Books`; `Practice material` → `Practice papers`. Topics support English/Arabic commas. Format/language/college absent from the Form remain unset for administrator completion. Do not infer language or translate automatically. A real Sheet date is converted to a numeric Sheet timestamp in the spreadsheet timezone. Private name and notes are separate from resource content; credit requires explicit Yes consent. Invalid URLs are never fetched or opened automatically and require correction. No full raw response payload is stored.

| Delivery status / error | Meaning / recovery |
| --- | --- |
| `delivered` | Imported or already present unchanged. It does not mean approved/published. |
| `retry: network_failure`, `http_429`, `ingest_database_failure` | Temporary failure; automatic retry or Retry pending. |
| `error: ingest_unauthorized` | Check matching secret, system time and endpoint. Retry manually after correction. |
| `error: source_not_allowed` | Correct environment-specific spreadsheet/tab configuration. |
| `error: source_conflict` | Same UUID has changed content. Review the existing Labs item; no automatic overwrite or new ID. |
| `error: invalid_timestamp`, `invalid_cell` | Correct the undelivered source row, then Retry pending. |
| `missing_columns`, `ambiguous_columns`, `duplicate_response_id` | Inspect headers/IDs; script stops safely. Do not regenerate existing IDs blindly. |
| `ingest_disabled` / `ingest_configuration_missing` | Complete server setup and enable intake when ready. |
| Unexpected HTTP / no acknowledgment | Check the canonical host and deployment protection. Redirects are not followed. |

The script stores no response copies in Script Properties. It records only configuration, setup verification, a round-robin retry cursor and `STUDY_HUB_LAST_RESULT` containing counts/fixed codes. Batches attempt at most 25 rows and stop starting work after 45 seconds. Permanent errors do not retry automatically; manual Retry pending rechecks them. The cursor prevents one persistently failing row from starving later responses. One bad row need not block others; duplicate IDs and header failures stop the batch. Limits are 50,000 rows and 100 columns. There is no source-version reconciliation.

The bilingual Labs dashboard has Refresh submissions, pending count and last imported timestamp. Delivery failures live in the Sheet/Apps Script because requests that never reach Labs cannot be reported by Labs. A last-imported timestamp is not a trigger-health guarantee. The existing admin-only list/detail/save/reject/reopen/convert APIs are retained. Conversion preserves existing metadata, consent, terms, duplicate and publication checks. No automatic deletion/retention process is introduced.

#### Localhost testing

For normal Vercel development, use an **isolated test Supabase database** and synthetic data. Local execution does not isolate the database automatically. Keep production keys out of the development `.env` and Preview configuration.

1. In this Labs worktree, run `npm.cmd ci` and apply the four named migrations to the isolated environment. Set existing Supabase/Auth variables in the ignored `.env`.
2. Add a locally generated ingestion secret, `STUDY_HUB_INGEST_ENABLED=true`, `STUDY_HUB_GOOGLE_SPREADSHEET_ID=synthetic_study_hub_sheet`, and `STUDY_HUB_GOOGLE_SHEET_ID=12`.
3. Run `npx.cmd vercel dev`; restart after changing `.env`. This static project's verified local workflow uses `.env`, not `.env.local` alone.
4. In another terminal in the same worktree, run:

```powershell
node --env-file=.env scripts/send-study-hub-test.cjs --check
node --env-file=.env scripts/send-study-hub-test.cjs
node --env-file=.env scripts/send-study-hub-test.cjs
```

Expect `ready`, `imported`, then `already_synced` (an existing fixture may already return `already_synced`). The helper is restricted to loopback and the synthetic sheet identifier. To use another localhost port, append `http://localhost:PORT/api/integrations/study-hub-ingest`. Open `/study-hub-admin.html` as a test administrator and review the synthetic item. Missing publication metadata must block conversion until corrected.

Apps Script runs on Google's servers and cannot reach your localhost. Test its real delivery using a separate staging HTTPS deployment, test Form/Sheet and test database. Automated tests mock Google; no live Form or production student rows are used.

#### Staging and production rollout (manual; not performed by Codex)

1. Apply the new migration to staging, configure staging-only variables with imports disabled, and deploy the reviewed Labs branch when authorized. Point a synthetic Sheet's script at the canonical staging HTTPS URL. Keep Production secrets scoped to Production.
2. Verify actual Form settings/headers and the signed connection check. For a protected Preview, follow **Protected Preview machine access** above, including the project-wide scope approval. Keep protection enabled; do not disable organization policy or add a secret-bearing query string. Use an isolated staging project when strict separation from production is required.
3. Enable staging intake and verify new delivery, lost-response/retry behavior, rejection, approval into draft, duplicate-resource blocking and explicit publication using synthetic data.
4. After staging passes, apply the named pending production migration(s), deploy Labs with production intake disabled, and configure the real Restricted Sheet's script/secret. Run setup and header-only connection check before enabling ingestion.
5. Enable production intake through the server environment and redeploy for the change to take effect. Verify the triggers created by standalone setup, then explicitly backfill/review real responses as the authorized administrator. Production configuration and this import are manual operations, not automated tests.
6. To pause, set `STUDY_HUB_INGEST_ENABLED=false` and redeploy, and/or disable Google triggers. Existing submissions and resources remain. To rotate secrets, pause triggers, replace the secret on both sides, redeploy, run the connection check, then resume and run `retryPendingStudyHub` from the standalone editor. No second key/version protocol is introduced.

#### Automated verification

- `npm.cmd test`: existing Labs suite, resource-management tests, mapping/access tests, signed ingestion tests and standalone Apps Script VM tests (no active spreadsheet, document lock, or Sheet UI). Tests also cover trigger installation, repeat setup, stale/duplicate cleanup, failure blocking and cross-spreadsheet event rejection.
- `npm.cmd run study-hub:db-test`: exact migrations in a fresh temporary database inside the explicitly named disposable `nexcore-study-hub-test` container; synthetic SQL fixtures roll back. Tests verify service-only function grants, private RLS, immutable idempotency, conflicts, conversion, duplicate resources, publication and existing role boundaries. This bootstrap models Labs identity tables; it does not replay every historical Labs migration.
- `npm.cmd run study-hub:browser`: English/Arabic mobile browser workflow with real local API/PostgreSQL, signed concurrent deliveries and simulated administrator/editor/member sessions. The local harness binds 4189 (Labs) and 4190 (public Study Hub, read-only source). Set `STUDY_HUB_ROOT` if needed. Never deploy this harness.
- `npm.cmd run routes:test` and `git diff --check`: route and patch checks.

The existing disposable browser container uses `supabase/postgres:17.6.1.021`; apply the new migration there before running the browser tests if it already has the earlier three migrations. Test identities use `example.invalid`. VM/Playwright tests do not prove live Google authorization, actual trigger scheduling, live administrator sign-in, deployment protection, production RLS configuration, or real private Sheet headers/settings. Verify those during controlled staging setup.


## Initial resource-management release order

1. Review and apply only the named pending editorial-workflow, admin-flag, submissions and signed-ingestion migrations in the shared Supabase project. Check pending migrations before using any batch deployment command. Do not apply unrelated migrations from another branch.
2. Verify anonymous/authenticated read/write denial, the protected flag, service-only function grants and Supabase security advisors. Do not run fixture-writing tests against production.
3. Deploy this Labs branch. Existing `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and public Auth key configuration are reused. Verify a real admin session, grant access to an intended existing user, and verify an Editor session.
4. Publish an actually reviewed resource through the UI. Check both locales and access without sign-in.
5. For an initial resource-management rollout, deploy the matching Study Hub frontend, including its updated service-worker cache version. The signed-intake addition alone requires no public Study Hub runtime deployment. It fails visibly if Supabase is unavailable and does not restore removed records from local JSON.

Rollback the frontend deployment independently if necessary; retain additive database tables and audit history. Revoke Editor assignments if management must be suspended. Archive a resource to remove it from new catalogue loads; removal does not revoke an externally shared Drive link or an already-loaded browser copy. Public metadata uses keyset pagination without persistent offline caching. Move search/filtering into database queries when catalogue size warrants it.

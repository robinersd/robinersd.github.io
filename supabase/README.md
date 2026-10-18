# Portfolio visitors and feedback

Status: backend deployed and live-verified on 2026-10-18 using the connected
account named `robinersd portfolio`. Remote migration `20261018005911`,
`create_portfolio_community`, created the schema. Edge Function
`portfolio-community` version 1 is ACTIVE.

Real HTTP checks passed for Vercel, GitHub Pages and the local preview: stats,
CORS/preflight, session start and deduplication, heartbeat, signed session
validation, feedback insertion and duplicate prevention. Direct anonymous
table/RPC access is denied. The temporary test session and rating were removed;
no fabricated visits, historical totals or ratings were retained.

`site/assets/community-config.js` is enabled with only the project's publishable
key. The frontend changes must still be committed and pushed before the hosted
Vercel/GitHub Pages sites use this connection. A backend deployment does not
update those static frontend files automatically.

Security advisors reported no WARN/ERROR findings; the four INFO notices for
RLS without policies are intentional: all tables are backend-only, visitor
grants are revoked, and service_role performs the permitted operations.
See https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy.
Performance advisors reported no findings. SQL rollback integration checks,
isolated PostgreSQL checks and the Node suite also passed.

`setup.sql` explicitly resets service_role grants before assigning backend
operations, accounting for Supabase default privileges. `verify.sql` verifies
permissions and exercises session/feedback behavior inside a rolled-back
transaction. It leaves no synthetic visits, ratings or comments behind. The
isolated database harness lives in the workspace staging folder under
`db-verification/`, not in production assets.

## Intended project

- Verified portfolio project reference: `muoixozgmsohsfkxeiaw`
- Previous project `onvrmolzomzwhccqmxka` belonged to the wrong account; do not deploy there.
- Frontends: `https://robinersd.vercel.app` and `https://robinersd.github.io`
- Backend: Supabase Edge Function `portfolio-community`
- No frontend framework conversion, login for visitors, or paid add-on is needed.

## Behavior

- A visit is one accepted anonymous browser-tab session. Reloads and SPA route
  changes retain its session UUID in sessionStorage. Opening another browser or
  origin starts a different session. Counts start when tracking is activated;
  historical traffic is not invented or imported.
- Viewing now estimates active, visible browser sessions. Heartbeats run every
  25 seconds while visible. Hidden/closed tabs request inactive status; missed
  heartbeats expire from the count after 70 seconds. This is approximate and
  cannot identify unique people. No background polling or WebSocket is required.
- Only the average stars and rating count are public. Individual feedback rows,
  session records and comments cannot be read by anonymous/authenticated visitors.
- The home-page popup appears after reaching the end of the main content and
  scrolling back near the top. It waits for existing viewers/chat to close.
  It is shown once per tab session, including after Skip, X or Escape, and does
  not repeat after a reload in that session. Visitors can open it manually later.
- One confirmed rating per session. Stars are required, comments optional and
  limited to 1,500 characters. Failed sends retain input for retry.

## Database and API

`setup.sql` creates only the four `portfolio_*` tables and three RPCs required by
this feature. Run it once on the intended project after confirming the objects
do not already exist. It is transactional; do not rerun it over an existing
installation without inspecting the schema first.

All tables have RLS enabled, with all PUBLIC, anon and authenticated grants
revoked. RPCs are SECURITY INVOKER with an empty search_path and EXECUTE granted
only to service_role. The Edge Function alone authenticates to the Data API
using a server-side secret. It returns a strict aggregate-only response.

The function verifies its publishable `apikey` header, checks the exact allowed
Origin, validates bounded JSON bodies, and requires a signed session token for
heartbeat/feedback. Configure `verify_jwt = false`: publishable keys are not JWTs,
and the handler performs its own API-key and session checks. Never put backend
secret values in config, client JavaScript, source control, logs or chat.

The runtime reads the injected `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEYS` and
`SUPABASE_SECRET_KEYS` variables. These new key maps must be present. The default
secret key stays in the Edge runtime. No secret is needed in Vercel/GitHub Pages.

`functions/portfolio-community/index.ts` is the versioned entrypoint with
`handler.js`. `portfolio-community.editor.ts` is a generated equivalent single
file for the Supabase dashboard editor if a manual deployment is needed.

## Deployment workflow for future changes

1. Verify that the connected account can read the intended project, its existing
   tables and functions. Do not deploy to the unrelated AlagaTrack project.
2. The initial `setup.sql` has already been applied. Use a reviewed incremental
   migration for future schema changes; do not rerun the initial setup.
   Check advisors and confirm visitor table/RPC privileges remain absent.
3. Deploy `portfolio-community` with its handler and `verify_jwt = false`.
4. Obtain the project's enabled publishable key and put only that public key in
   `site/assets/community-config.js`. Set `enabled: true` after backend checks.
5. Verify real HTTP stats requests from both allowed site origins and the local
   preview. Test session/feedback transactions with rollback before using live
   user data. Verify direct anonymous feedback reads fail.
6. Run the complete Node test suite and manually verify desktop/mobile rendering,
   native radio keyboard controls, modal close/Skip/Escape, private comments,
   session deduplication and presence expiry. Commit/push frontend changes only
   after the integration is verified.

Changes to frontend code follow the normal GitHub/Vercel deployment workflow.
Database changes and updated Edge Functions must also be deployed to Supabase;
a frontend git push alone does not deploy the Supabase backend.

## Reading private comments

As the project owner, open Supabase Table Editor and select `portfolio_feedback`.
No public comments endpoint or public feedback list exists. Keep this table
restricted; do not add visitor SELECT policies to make aggregate ratings work.

## Abuse and retention

The server uses a honeypot, signed session tokens and best-effort network rate
limits (120 new sessions/hour and 10 feedback submissions/hour per daily keyed
network digest). Raw IP addresses are not stored in these tables. Network limits
are not a guarantee against determined bots; anonymous counters/ratings are not
identity verification. Add a CAPTCHA if real abuse warrants it.

Old presence rows are removed after seven inactive days; expired rate buckets
are pruned on new accepted sessions. Lifetime totals and feedback remain.
Public API failures show unavailable statistics, never fake zero visitors or a
fake successful submission. Unconfigured builds disable feedback submission and
automatic prompts. Supabase Free quotas and inactivity pausing still apply.

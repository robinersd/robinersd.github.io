# Visitors and feedback backend

Supabase stores aggregate metrics, temporary visitor sessions, private feedback, and request-limit counters. The `portfolio-community` Edge Function validates requests and exposes only visitor totals, active-viewer estimates, rating counts, and average ratings.

## Access model

All four community tables have RLS enabled and explicit policies limited to the backend role. Visitor roles have no direct table or RPC privileges. Existing backend grants restrict each table to the operations the API needs; no public feedback read policy is provided.

## SQL files

- `setup.sql`: initial schema for a new installation. Do not rerun over an existing schema.
- `backend-only-policies.sql`: repeatable policy update for an existing installation.
- `verify.sql`: permission and integration checks in a rolled-back transaction. Test visits and ratings are not retained.

Database and Edge Function deployments are separate from frontend publishing. After backend changes, run the SQL verification and Supabase advisors before releasing the frontend.

## Behavior

Visits are counted per browser-tab session. Presence estimates depend on heartbeats and expire when sessions stop responding. A session can submit one rating with an optional comment. Public responses contain aggregate values only; comments remain available through authorized project administration.

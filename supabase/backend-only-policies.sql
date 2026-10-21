-- Explicitly document backend-only access without granting visitor privileges.
-- service_role already bypasses RLS; existing table grants remain the operation limits.
begin;
drop policy if exists portfolio_feedback_backend_only on public.portfolio_feedback;
create policy portfolio_feedback_backend_only on public.portfolio_feedback
  for all to service_role using (true) with check (true);
drop policy if exists portfolio_metrics_backend_only on public.portfolio_metrics;
create policy portfolio_metrics_backend_only on public.portfolio_metrics
  for all to service_role using (true) with check (true);
drop policy if exists portfolio_sessions_backend_only on public.portfolio_sessions;
create policy portfolio_sessions_backend_only on public.portfolio_sessions
  for all to service_role using (true) with check (true);
drop policy if exists portfolio_request_limits_backend_only on public.portfolio_request_limits;
create policy portfolio_request_limits_backend_only on public.portfolio_request_limits
  for all to service_role using (true) with check (true);
commit;

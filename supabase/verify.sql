-- Integration checks only. Every synthetic visit/rating is rolled back.
begin;
set local statement_timeout = '15s';

do $$
declare
  role_name text;
  table_name text;
begin
  foreach table_name in array array['portfolio_metrics', 'portfolio_sessions', 'portfolio_feedback', 'portfolio_request_limits'] loop
    if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = table_name and c.relrowsecurity) then
      raise exception 'Missing RLS: %', table_name;
    end if;
    foreach role_name in array array['anon', 'authenticated'] loop
      if has_table_privilege(role_name, 'public.' || table_name, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
        raise exception 'Unexpected visitor table access: %, %', role_name, table_name;
      end if;
    end loop;
  end loop;
  foreach role_name in array array['anon', 'authenticated'] loop
    if has_function_privilege(role_name, 'public.portfolio_summary()', 'EXECUTE')
      or has_function_privilege(role_name, 'public.portfolio_consume_limit(text,integer)', 'EXECUTE')
      or has_function_privilege(role_name, 'public.portfolio_community(text,uuid,boolean,integer,text,text,text)', 'EXECUTE') then
      raise exception 'Unexpected visitor RPC access: %', role_name;
    end if;
  end loop;
  if has_table_privilege('service_role', 'public.portfolio_feedback', 'UPDATE,DELETE,TRUNCATE')
    or has_table_privilege('service_role', 'public.portfolio_metrics', 'INSERT,DELETE,TRUNCATE') then
    raise exception 'Unexpected backend table grants';
  end if;
end;
$$;

set local role service_role;
do $$
declare
  test_session uuid := gen_random_uuid();
  rate_key text := gen_random_uuid()::text;
  initial_visits bigint;
  initial_ratings bigint;
  initial_sum bigint;
  response jsonb;
begin
  -- Briefly serialize metric changes so live traffic cannot alter the assertions.
  select total_visits, rating_count, rating_sum into initial_visits, initial_ratings, initial_sum
    from public.portfolio_metrics where id = 1 for update;
  response := public.portfolio_community('start', test_session, true, null, '', 'verification', rate_key);
  if (response->'stats'->>'totalVisits')::bigint <> initial_visits + 1 then
    raise exception 'Visit was not counted';
  end if;
  response := public.portfolio_community('start', test_session, true, null, '', 'verification', rate_key);
  if (response->'stats'->>'totalVisits')::bigint <> initial_visits + 1 then
    raise exception 'Repeated session was double counted';
  end if;
  perform public.portfolio_community('heartbeat', test_session, false, null, '', 'verification', rate_key);
  if exists (select 1 from public.portfolio_sessions where session_id = test_session and active) then
    raise exception 'Hidden session stayed active';
  end if;
  response := public.portfolio_community('feedback', test_session, true, 4, '  verification only  ', 'verification', rate_key);
  if (response->'stats'->>'ratingCount')::bigint <> initial_ratings + 1
    or (response->'stats'->>'averageRating')::numeric <> round((initial_sum + 4)::numeric / (initial_ratings + 1), 1) then
    raise exception 'Rating aggregate was not updated';
  end if;
  if response::text like '%verification only%' then
    raise exception 'Private comment leaked into response';
  end if;
  response := public.portfolio_community('feedback', test_session, true, 1, 'duplicate', 'verification', rate_key);
  if response->>'status' <> 'already_submitted' or (response->'stats'->>'ratingCount')::bigint <> initial_ratings + 1 then
    raise exception 'Repeated rating was not deduplicated';
  end if;
  begin
    perform public.portfolio_community('feedback', test_session, true, 6, '', 'verification', rate_key);
    raise exception 'Invalid rating was accepted';
  exception when sqlstate 'PT400' then null;
  end;
end;
$$;
reset role;
select 'Portfolio schema, permissions and rollback integration checks passed.' as verification;
rollback;

-- Portfolio community API. All tables and RPCs are backend-only.
-- Run once on the portfolio project; do not run against an unrelated project.
begin;

create table public.portfolio_metrics (
  id smallint primary key check (id = 1),
  total_visits bigint not null default 0 check (total_visits >= 0),
  rating_sum bigint not null default 0 check (rating_sum >= 0),
  rating_count bigint not null default 0 check (rating_count >= 0),
  check (rating_sum >= rating_count and rating_sum <= rating_count * 5)
);
insert into public.portfolio_metrics (id) values (1);

create table public.portfolio_sessions (
  session_id uuid primary key,
  started_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  active boolean not null default true,
  origin text not null check (length(origin) <= 200)
);
create index portfolio_sessions_active_seen_idx on public.portfolio_sessions (last_seen) where active;

create table public.portfolio_feedback (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 1500),
  created_at timestamptz not null default now(),
  origin text not null check (length(origin) <= 200)
);
comment on table public.portfolio_feedback is
  'Private feedback. Read in Supabase Table Editor as a project administrator. Never grant frontend SELECT.';

create table public.portfolio_request_limits (
  bucket text primary key check (length(bucket) <= 160),
  requests integer not null,
  expires_at timestamptz not null
);

alter table public.portfolio_metrics enable row level security;
alter table public.portfolio_sessions enable row level security;
alter table public.portfolio_feedback enable row level security;
alter table public.portfolio_request_limits enable row level security;
revoke all on public.portfolio_metrics, public.portfolio_sessions,
  public.portfolio_feedback, public.portfolio_request_limits from public, anon, authenticated;
-- Supabase may grant ALL to service_role through default privileges.
-- Remove inherited object grants before assigning the exact backend operations.
revoke all on public.portfolio_metrics, public.portfolio_sessions,
  public.portfolio_feedback, public.portfolio_request_limits from service_role;
grant select, update on public.portfolio_metrics to service_role;
grant select, insert on public.portfolio_feedback to service_role;
grant select, insert, update, delete on public.portfolio_sessions,
  public.portfolio_request_limits to service_role;

create function public.portfolio_summary() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'totalVisits', total_visits,
    'liveVisitors', (select count(*) from public.portfolio_sessions
      where active and last_seen > now() - interval '70 seconds'),
    'ratingCount', rating_count,
    'averageRating', case when rating_count = 0 then null
      else round(rating_sum::numeric / rating_count, 1) end
  ) from public.portfolio_metrics where id = 1;
$$;

create function public.portfolio_consume_limit(p_bucket text, p_max integer) returns void
language plpgsql security invoker set search_path = '' as $$
declare hits integer;
begin
  insert into public.portfolio_request_limits (bucket, requests, expires_at)
  values (p_bucket, 1, now() + interval '2 hours')
  on conflict (bucket) do update set requests = public.portfolio_request_limits.requests + 1
  returning requests into hits;
  if hits > p_max then raise sqlstate 'PT429' using message = 'rate_limited'; end if;
end;
$$;

create function public.portfolio_community(
  p_action text,
  p_session_id uuid default null,
  p_active boolean default true,
  p_rating integer default null,
  p_comment text default '',
  p_origin text default '',
  p_rate_key text default ''
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  inserted_id uuid;
  result_status text := 'ok';
  hour_bucket text := floor(extract(epoch from now()) / 3600)::bigint::text;
begin
  if p_action = 'stats' then return jsonb_build_object('stats', public.portfolio_summary()); end if;
  if p_action not in ('start', 'heartbeat', 'feedback') or p_session_id is null
    or p_origin is null or length(p_origin) > 200 then
    raise sqlstate 'PT400' using message = 'invalid_request';
  end if;

  if p_action = 'start' then
    insert into public.portfolio_sessions (session_id, active, origin)
    values (p_session_id, p_active, p_origin)
    on conflict (session_id) do nothing returning session_id into inserted_id;
    if inserted_id is not null then
      perform public.portfolio_consume_limit('visit:' || p_rate_key || ':' || hour_bucket, 120);
      update public.portfolio_metrics set total_visits = total_visits + 1 where id = 1;
      -- Presence rows are temporary; lifetime totals and feedback remain stored.
      delete from public.portfolio_sessions where last_seen < now() - interval '7 days';
      delete from public.portfolio_request_limits where expires_at < now();
    else
      update public.portfolio_sessions set last_seen = now(), active = p_active
      where session_id = p_session_id;
    end if;
  elsif p_action = 'heartbeat' then
    update public.portfolio_sessions set last_seen = now(), active = p_active
    where session_id = p_session_id;
    if not found then raise sqlstate 'PT404' using message = 'session_expired'; end if;
  elsif p_action = 'feedback' then
    if p_rating is null or p_rating not between 1 and 5
      or p_comment is null or char_length(p_comment) > 1500 then
      raise sqlstate 'PT400' using message = 'invalid_feedback';
    end if;
    if not exists (select 1 from public.portfolio_sessions where session_id = p_session_id) then
      raise sqlstate 'PT404' using message = 'session_expired';
    end if;
    insert into public.portfolio_feedback (session_id, rating, comment, origin)
    values (p_session_id, p_rating, trim(p_comment), p_origin)
    on conflict (session_id) do nothing returning id into inserted_id;
    if inserted_id is null then result_status := 'already_submitted';
    else
      perform public.portfolio_consume_limit('feedback:' || p_rate_key || ':' || hour_bucket, 10);
      update public.portfolio_metrics set rating_sum = rating_sum + p_rating,
        rating_count = rating_count + 1 where id = 1;
    end if;
  end if;
  return jsonb_build_object('status', result_status, 'stats', public.portfolio_summary());
end;
$$;

revoke all on function public.portfolio_summary(), public.portfolio_consume_limit(text, integer),
  public.portfolio_community(text, uuid, boolean, integer, text, text, text)
  from public, anon, authenticated;
grant execute on function public.portfolio_summary(), public.portfolio_consume_limit(text, integer),
  public.portfolio_community(text, uuid, boolean, integer, text, text, text) to service_role;
commit;

-- Create helper RPCs for analytics dashboard

-- Returns a JSON object with high-level metric counts for a given time range.
create or replace function public.metrics_overview(p_start timestamptz, p_end timestamptz)
returns jsonb
language plpgsql
as $$
declare
  total_events bigint;
  total_impressions bigint;
  total_clicks bigint;
  unique_ids bigint;
  avg_watch_seconds numeric;
begin
  if p_start is null then
    p_start := date_trunc('day', now() - interval '7 days');
  end if;
  if p_end is null then
    p_end := now();
  end if;

  select count(*) into total_events from public.activity_events where occurred_at >= p_start and occurred_at < p_end;
  select count(*) into total_impressions from public.sponsor_impressions where occurred_at >= p_start and occurred_at < p_end;
  select count(*) into total_clicks from public.sponsor_clicks where occurred_at >= p_start and occurred_at < p_end;
  select count(distinct coalesce(user_id::text, anonymous_id::text)) into unique_ids from public.activity_events where occurred_at >= p_start and occurred_at < p_end;
  select avg(duration_ms) / 1000.0 into avg_watch_seconds from public.activity_events where duration_ms is not null and occurred_at >= p_start and occurred_at < p_end;

  return jsonb_build_object(
    'total_activity_events', coalesce(total_events, 0),
    'total_sponsor_impressions', coalesce(total_impressions, 0),
    'total_sponsor_clicks', coalesce(total_clicks, 0),
    'unique_active_ids', coalesce(unique_ids, 0),
    'avg_watch_seconds', coalesce(avg_watch_seconds, 0)
  );
end;
$$;

-- Grant execute to authenticated (server will typically call with service role)
grant execute on function public.metrics_overview(timestamptz, timestamptz) to authenticated;

-- Lightweight helper view for stream-level peak/avg viewers (can be expanded later)
create or replace view public.metrics_streams_agg as
select
  stream_id,
  date_trunc('day', occurred_at) as day,
  count(*) filter (where event_type = 'view_start') as view_starts,
  count(distinct coalesce(user_id::text, anonymous_id::text)) as unique_users,
  max((properties ->> 'concurrent_viewers')::int) as peak_viewers,
  avg(nullif((properties ->> 'concurrent_viewers')::numeric, 0)) as avg_viewers
from public.activity_events
where stream_id is not null
group by stream_id, date_trunc('day', occurred_at);

grant select on public.metrics_streams_agg to authenticated;

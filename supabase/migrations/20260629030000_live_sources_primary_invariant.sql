-- Enforce one active primary source per event without invalidating older rows.
with ranked_primary as (
  select id,
         row_number() over (partition by event_id order by updated_at desc, created_at desc, id) as position
  from public.live_sources
  where is_primary and is_enabled and deleted_at is null
)
update public.live_sources as source
set is_primary = false,
    updated_at = now()
from ranked_primary
where source.id = ranked_primary.id and ranked_primary.position > 1;

create unique index if not exists live_sources_one_active_primary_per_event_idx
  on public.live_sources (event_id)
  where is_primary and is_enabled and deleted_at is null;

comment on index public.live_sources_one_active_primary_per_event_idx is
  'Prevents more than one enabled, non-deleted primary playback source per event.';

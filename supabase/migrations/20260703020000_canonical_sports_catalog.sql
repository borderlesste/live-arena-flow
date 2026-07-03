-- Canonical sports catalog: keep provider IDs stable while linking streams to
-- the internal match row used by both synchronized and locally-created events.

alter table public.live_sources
  add column if not exists match_id uuid references public.matches(id) on delete set null;

create index if not exists live_sources_match_id_idx
  on public.live_sources (match_id)
  where match_id is not null and deleted_at is null;

create index if not exists matches_external_id_active_idx
  on public.matches (external_id)
  where external_id is not null and deleted_at is null;

-- Best-effort compatibility backfill. Rows not yet synchronized remain linked
-- by event_id and will receive match_id the next time they are edited/created.
update public.live_sources as source
set match_id = match.id
from public.matches as match
where source.match_id is null
  and source.event_id = match.external_id
  and source.deleted_at is null
  and match.deleted_at is null;

comment on column public.live_sources.match_id is
  'Canonical internal match relation. event_id remains the stable public/provider identifier for backward compatibility.';

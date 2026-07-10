-- Preserve provider states that are not yet mapped instead of presenting them as scheduled.
alter table public.matches
  drop constraint if exists matches_status_check;

alter table public.matches
  add constraint matches_status_check
  check (status in ('scheduled', 'live', 'halftime', 'paused', 'finished', 'postponed', 'cancelled', 'unknown'));

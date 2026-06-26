-- Migration: Add idempotency_key to live_sources to prevent duplicate submissions
-- This column allows the backend to detect and de-duplicate requests that carry
-- the same Idempotency-Key header (e.g. from double-clicks or network retries).

alter table public.live_sources
  add column if not exists idempotency_key text unique;

-- Index to make the idempotency lookup fast
create index if not exists live_sources_idempotency_key_idx
  on public.live_sources (idempotency_key)
  where idempotency_key is not null;

-- Also add index on created_at if missing (for ordered listing)
create index if not exists live_sources_created_at_idx
  on public.live_sources (created_at desc)
  where deleted_at is null;

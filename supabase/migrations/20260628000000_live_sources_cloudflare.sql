-- Migration: Extend live_sources for Cloudflare Stream Live Inputs and richer status model
-- Compatible with existing data — all changes use ALTER TABLE ... ADD COLUMN IF NOT EXISTS

-- ── New columns ────────────────────────────────────────────────────────────────

-- Cloudflare Stream customer code for building HLS playback URLs
alter table public.live_sources
  add column if not exists provider_customer_code text;

-- Extended status values for Cloudflare's lifecycle
-- We extend the existing CHECK constraint via a new constraint name.
-- First drop the existing check, then add the extended one.
alter table public.live_sources
  drop constraint if exists live_sources_status_check;

alter table public.live_sources
  add constraint live_sources_status_check check (
    status in (
      'provisioning',
      'waiting_signal',
      'connecting',
      'live',
      'reconnecting',
      'disconnected',
      'disabled',
      'provision_failed',
      'provider_error',
      'deletion_pending',
      'deletion_failed',
      'deleted',
      -- Legacy values kept for backward compat:
      'ready',
      'error'
    )
  );

-- Timestamp of last successful sync with the provider (Cloudflare / MediaMTX)
alter table public.live_sources
  add column if not exists last_provider_sync_at timestamptz;

-- Stores a sanitized error code (never the full error body)
alter table public.live_sources
  add column if not exists provider_error_code text;

-- Webhook deduplication: stores processed webhook event keys
create table if not exists public.live_source_webhook_events (
  id             uuid primary key default gen_random_uuid(),
  event_key      text not null unique,   -- input_id + event_type + updated_at hash
  source_id      uuid references public.live_sources(id) on delete cascade,
  event_type     text not null,
  processed_at   timestamptz not null default now()
);

create index if not exists webhook_events_event_key_idx
  on public.live_source_webhook_events (event_key);

create index if not exists webhook_events_processed_at_idx
  on public.live_source_webhook_events (processed_at desc);

-- RLS for webhook events table
alter table public.live_source_webhook_events enable row level security;

create policy webhook_events_admin_all on public.live_source_webhook_events
  for all to authenticated
  using ((select public.has_role(array['super_admin'::public.app_role, 'admin'::public.app_role])))
  with check ((select public.has_role(array['super_admin'::public.app_role, 'admin'::public.app_role])));

-- ── Indexes ────────────────────────────────────────────────────────────────────

create index if not exists live_sources_provider_input_id_idx
  on public.live_sources (provider_input_id)
  where provider_input_id is not null;

create index if not exists live_sources_last_provider_sync_idx
  on public.live_sources (last_provider_sync_at desc nulls last)
  where deleted_at is null;

-- ── Updated_at trigger (if not already set) ───────────────────────────────────

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'live_sources_set_updated_at'
      and tgrelid = 'public.live_sources'::regclass
  ) then
    create trigger live_sources_set_updated_at
      before update on public.live_sources
      for each row execute function public.set_updated_at();
  end if;
end;
$$;

-- ── Comments ───────────────────────────────────────────────────────────────────

comment on column public.live_sources.provider_customer_code is
  'Cloudflare Stream customer subdomain code used to build HLS playback URL: https://customer-{code}.cloudflarestream.com/{uid}/manifest/video.m3u8';

comment on column public.live_sources.last_provider_sync_at is
  'Timestamp of the last successful status poll or webhook update from the streaming provider.';

comment on column public.live_sources.provider_error_code is
  'Sanitized error code from the provider. Never stores full error bodies or credentials.';

comment on table public.live_source_webhook_events is
  'Deduplication log for incoming webhook events from streaming providers (Cloudflare Stream, etc).';

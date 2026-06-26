-- Migration: Add live_sources table for modular streaming inputs (focused on Custom RTMP)
create table if not exists public.live_sources (
  id uuid primary key default gen_random_uuid(),
  event_id text not null, -- references external match/event ID
  name text not null,
  source_kind text not null check (source_kind in ('manual', 'obs')),
  usage_type text not null default 'live' check (usage_type in ('live', 'highlight', 'prerecorded')),
  playback_format text not null, -- hls, mp4, etc.
  playback_url text,
  provider text not null default 'custom',
  provider_input_id text unique,
  ingest_protocol text check (ingest_protocol in ('rtmp', 'rtmps', 'srt')),
  ingest_url text,
  stream_key_ciphertext text,
  stream_key_iv text,
  stream_key_last4 text,
  credentials_version integer not null default 1,
  status text not null default 'ready' check (status in ('provisioning', 'ready', 'connecting', 'live', 'disconnected', 'disabled', 'error')),
  status_message text,
  is_enabled boolean not null default true,
  is_primary boolean not null default false,
  recording_enabled boolean not null default false,
  low_latency_enabled boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_connected_at timestamptz,
  last_disconnected_at timestamptz,
  deleted_at timestamptz
);

create index if not exists live_sources_event_id_idx on public.live_sources (event_id);
create index if not exists live_sources_status_idx on public.live_sources (status);
create index if not exists live_sources_is_primary_idx on public.live_sources (is_primary);

-- Enable RLS
alter table public.live_sources enable row level security;

-- Policies
create policy live_sources_public_read on public.live_sources
  for select to anon, authenticated
  using (is_enabled and deleted_at is null);

create policy live_sources_admin_all on public.live_sources
  for all to authenticated
  using ((select public.has_role(array['super_admin'::public.app_role, 'admin'::public.app_role])))
  with check ((select public.has_role(array['super_admin'::public.app_role, 'admin'::public.app_role])));

-- Grant access
grant select on public.live_sources to anon, authenticated;
grant all on public.live_sources to authenticated;

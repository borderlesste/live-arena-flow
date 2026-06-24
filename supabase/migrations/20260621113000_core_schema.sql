create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('super_admin', 'admin', 'moderator', 'user');
create type public.account_status as enum ('active', 'suspended', 'blocked', 'deleted');
create type public.stream_status as enum ('draft', 'scheduled', 'live', 'ended', 'disabled');
create type public.media_source_type as enum ('youtube', 'youtube_live', 'embed', 'iframe', 'mp4', 'mp3', 'hls', 'obs_hls');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  display_name text not null check (char_length(display_name) between 2 and 80),
  avatar_url text,
  account_status public.account_status not null default 'active',
  timezone text not null default 'America/Sao_Paulo',
  language text not null default 'pt-BR',
  preferences jsonb not null default '{}'::jsonb check (jsonb_typeof(preferences) = 'object'),
  auth_provider text,
  last_login_at timestamptz,
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'user',
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);
create index user_roles_role_user_idx on public.user_roles (role, user_id);

create table public.sports (
  id uuid primary key default gen_random_uuid(),
  external_id text,
  provider text not null,
  slug text not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_id)
);

create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid not null references public.sports(id) on delete restrict,
  external_id text,
  provider text not null,
  name text not null,
  region text,
  logo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_id)
);
create index competitions_sport_id_idx on public.competitions (sport_id);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid not null references public.sports(id) on delete restrict,
  external_id text,
  provider text not null,
  name text not null,
  short_name text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_id)
);
create index teams_sport_id_idx on public.teams (sport_id);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete restrict,
  home_team_id uuid not null references public.teams(id) on delete restrict,
  away_team_id uuid not null references public.teams(id) on delete restrict,
  external_id text,
  provider text not null,
  status text not null check (status in ('scheduled', 'live', 'halftime', 'paused', 'finished', 'postponed', 'cancelled')),
  starts_at timestamptz not null,
  venue text,
  home_score integer not null default 0 check (home_score >= 0),
  away_score integer not null default 0 check (away_score >= 0),
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (provider, external_id),
  check (home_team_id <> away_team_id)
);
create index matches_competition_starts_idx on public.matches (competition_id, starts_at desc) where deleted_at is null;
create index matches_status_starts_idx on public.matches (status, starts_at) where deleted_at is null;
create index matches_home_team_id_idx on public.matches (home_team_id);
create index matches_away_team_id_idx on public.matches (away_team_id);

create table public.streams (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches(id) on delete set null,
  internal_name text not null,
  public_title text not null,
  description text,
  status public.stream_status not null default 'draft',
  visibility text not null default 'public' check (visibility in ('public', 'authenticated', 'private')),
  is_primary boolean not null default false,
  requires_auth boolean not null default false,
  allow_chat boolean not null default true,
  allow_pip boolean not null default true,
  allow_share boolean not null default true,
  show_viewer_count boolean not null default true,
  poster_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text not null default 'America/Sao_Paulo',
  priority integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create unique index streams_single_global_primary_idx on public.streams (is_primary) where is_primary and deleted_at is null;
create index streams_status_starts_idx on public.streams (status, starts_at) where deleted_at is null;
create index streams_match_id_idx on public.streams (match_id);

create table public.stream_sources (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.streams(id) on delete cascade,
  source_type public.media_source_type not null,
  playback_url text,
  youtube_id text,
  provider text,
  poster_url text,
  position integer not null default 0 check (position >= 0),
  enabled boolean not null default true,
  diagnostics jsonb not null default '{}'::jsonb,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (playback_url is not null or youtube_id is not null)
);
create unique index stream_sources_stream_position_idx on public.stream_sources (stream_id, position);

create table public.stream_ingest_secrets (
  stream_id uuid primary key references public.streams(id) on delete cascade,
  provider text not null,
  ingest_protocol text not null check (ingest_protocol in ('rtmp', 'rtmps', 'srt')),
  ingest_url text not null,
  encrypted_stream_key text not null,
  last_signal_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.presence_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  anonymous_id uuid,
  stream_id uuid references public.streams(id) on delete cascade,
  device_id uuid not null,
  tab_id uuid not null,
  state text not null check (state in ('online', 'watching', 'chatting')),
  connected_at timestamptz not null default now(),
  last_heartbeat_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (device_id, tab_id),
  check (user_id is not null or anonymous_id is not null)
);
create index presence_active_idx on public.presence_sessions (state, expires_at desc);
create index presence_stream_active_idx on public.presence_sessions (stream_id, expires_at desc);
create index presence_user_id_idx on public.presence_sessions (user_id);

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  user_id uuid references auth.users(id) on delete set null,
  anonymous_id uuid,
  stream_id uuid references public.streams(id) on delete set null,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  duration_ms bigint check (duration_ms is null or duration_ms >= 0),
  properties jsonb not null default '{}'::jsonb,
  country_code text check (country_code is null or char_length(country_code) = 2),
  device_type text
);
create index activity_events_type_occurred_idx on public.activity_events (event_type, occurred_at desc);
create index activity_events_stream_occurred_idx on public.activity_events (stream_id, occurred_at desc);
create index activity_events_user_occurred_idx on public.activity_events (user_id, occurred_at desc) where user_id is not null;

create table public.analytics_daily (
  day date not null,
  stream_id uuid references public.streams(id) on delete cascade,
  metric text not null,
  dimension jsonb not null default '{}'::jsonb,
  value numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (day, metric, stream_id, dimension)
);
create index analytics_daily_metric_day_idx on public.analytics_daily (metric, day desc);

create table public.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text not null,
  dark_logo_url text,
  alt_text text not null,
  destination_url text,
  description text,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'active', 'paused', 'ended')),
  priority integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index sponsors_status_priority_idx on public.sponsors (status, priority desc) where deleted_at is null;

create table public.sponsor_impressions (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  sponsor_id uuid not null references public.sponsors(id) on delete cascade,
  stream_id uuid references public.streams(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  anonymous_id uuid,
  visible_ratio numeric(4,3) not null check (visible_ratio between 0.5 and 1),
  occurred_at timestamptz not null default now(),
  device_type text,
  country_code text
);
create index sponsor_impressions_sponsor_occurred_idx on public.sponsor_impressions (sponsor_id, occurred_at desc);

create table public.sponsor_clicks (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  sponsor_id uuid not null references public.sponsors(id) on delete cascade,
  stream_id uuid references public.streams(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  anonymous_id uuid,
  occurred_at timestamptz not null default now(),
  utm jsonb not null default '{}'::jsonb
);
create index sponsor_clicks_sponsor_occurred_idx on public.sponsor_clicks (sponsor_id, occurred_at desc);

create table public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null unique references public.streams(id) on delete cascade,
  slow_mode_seconds integer not null default 4 check (slow_mode_seconds between 0 and 300),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reply_to_id uuid references public.chat_messages(id) on delete set null,
  body text not null check (char_length(body) between 1 and 500),
  pinned boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index chat_messages_room_created_idx on public.chat_messages (room_id, created_at desc) where deleted_at is null;
create index chat_messages_user_id_idx on public.chat_messages (user_id);

create table public.chat_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete restrict,
  target_user_id uuid references auth.users(id) on delete set null,
  message_id uuid references public.chat_messages(id) on delete set null,
  action text not null check (action in ('delete', 'mute', 'unmute', 'block', 'unblock', 'pin', 'unpin')),
  reason text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index moderation_room_created_idx on public.chat_moderation_actions (room_id, created_at desc);
create index moderation_target_user_idx on public.chat_moderation_actions (target_user_id, expires_at desc);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_value jsonb,
  after_value jsonb,
  result text not null check (result in ('success', 'denied', 'failure')),
  ip_hash text,
  user_agent_summary text,
  created_at timestamptz not null default now()
);
create index audit_logs_actor_created_idx on public.audit_logs (actor_id, created_at desc);
create index audit_logs_entity_created_idx on public.audit_logs (entity_type, entity_id, created_at desc);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger sports_set_updated_at before update on public.sports for each row execute function public.set_updated_at();
create trigger competitions_set_updated_at before update on public.competitions for each row execute function public.set_updated_at();
create trigger teams_set_updated_at before update on public.teams for each row execute function public.set_updated_at();
create trigger matches_set_updated_at before update on public.matches for each row execute function public.set_updated_at();
create trigger streams_set_updated_at before update on public.streams for each row execute function public.set_updated_at();
create trigger stream_sources_set_updated_at before update on public.stream_sources for each row execute function public.set_updated_at();
create trigger sponsors_set_updated_at before update on public.sponsors for each row execute function public.set_updated_at();

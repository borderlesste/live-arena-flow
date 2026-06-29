-- Security and streaming stabilization. Forward-only; previously applied migrations remain unchanged.

-- Profiles: authenticated users may only edit explicitly user-owned fields.
revoke update on public.profiles from authenticated;
grant update (first_name, last_name, display_name, avatar_url, timezone, language, preferences)
  on public.profiles to authenticated;

-- Chat: all sensitive transitions go through narrowly-scoped RPCs.
revoke update, delete on public.chat_messages from authenticated;
drop policy if exists chat_messages_delete_own on public.chat_messages;
drop policy if exists chat_messages_moderate on public.chat_messages;

create or replace function public.delete_own_chat_message(p_message_id uuid)
returns public.chat_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_message public.chat_messages;
begin
  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  update public.chat_messages
  set deleted_at = now()
  where id = p_message_id and user_id = v_user_id and deleted_at is null
  returning * into v_message;

  if v_message.id is null then
    raise exception 'MESSAGE_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;
  return v_message;
end;
$$;

create or replace function public.moderate_chat_message(
  p_message_id uuid,
  p_action text,
  p_reason text default null
)
returns public.chat_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_message public.chat_messages;
begin
  if v_actor_id is null or not public.has_role(array[
    'super_admin'::public.app_role,
    'admin'::public.app_role,
    'moderator'::public.app_role
  ]) then
    raise exception 'MODERATION_FORBIDDEN' using errcode = '42501';
  end if;
  if p_action not in ('delete', 'pin', 'unpin') then
    raise exception 'INVALID_MODERATION_ACTION' using errcode = '22023';
  end if;

  update public.chat_messages
  set
    deleted_at = case when p_action = 'delete' then now() else deleted_at end,
    pinned = case when p_action = 'pin' then true when p_action = 'unpin' then false else pinned end
  where id = p_message_id
    and (p_action <> 'delete' or deleted_at is null)
    and (p_action = 'delete' or deleted_at is null)
  returning * into v_message;

  if v_message.id is null then
    raise exception 'MESSAGE_NOT_FOUND_OR_INVALID_TRANSITION' using errcode = '22023';
  end if;

  insert into public.chat_moderation_actions (
    room_id, actor_id, target_user_id, message_id, action, reason
  ) values (
    v_message.room_id, v_actor_id, v_message.user_id, v_message.id, p_action, nullif(trim(p_reason), '')
  );
  return v_message;
end;
$$;

revoke all on function public.delete_own_chat_message(uuid) from public;
revoke all on function public.moderate_chat_message(uuid, text, text) from public;
grant execute on function public.delete_own_chat_message(uuid) to authenticated;
grant execute on function public.moderate_chat_message(uuid, text, text) to authenticated;

-- Analytics and raw live-source rows are backend-only.
revoke execute on function public.metrics_overview(timestamptz, timestamptz) from public, anon, authenticated;
revoke select on public.metrics_streams_agg from public, anon, authenticated;
grant execute on function public.metrics_overview(timestamptz, timestamptz) to service_role;
grant select on public.metrics_streams_agg to service_role;

drop policy if exists live_sources_public_read on public.live_sources;
revoke select on public.live_sources from anon, authenticated;

alter table public.live_sources
  add column if not exists playback_url_verified boolean not null default false;
alter table public.live_sources
  add column if not exists idempotency_fingerprint text;

-- Durable cleanup queue for replaced or externally undeleted provider resources.
create table if not exists public.live_source_provider_cleanup_jobs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.live_sources(id) on delete set null,
  provider text not null,
  provider_input_id text not null,
  reason text not null check (reason in ('rotation', 'delete_failed', 'create_compensation_failed')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error_code text,
  available_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_input_id, reason)
);
create index if not exists live_source_cleanup_pending_idx
  on public.live_source_provider_cleanup_jobs (available_at, created_at)
  where status in ('pending', 'failed');
alter table public.live_source_provider_cleanup_jobs enable row level security;
revoke all on public.live_source_provider_cleanup_jobs from public, anon, authenticated;
grant all on public.live_source_provider_cleanup_jobs to service_role;

create or replace function public.replace_live_source_input(
  p_source_id uuid,
  p_expected_provider_input_id text,
  p_new_provider_input_id text,
  p_new_ingest_url text,
  p_new_playback_url text,
  p_new_stream_key_last4 text,
  p_new_credentials_version integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider text;
begin
  update public.live_sources
  set provider_input_id = p_new_provider_input_id,
      ingest_url = p_new_ingest_url,
      playback_url = p_new_playback_url,
      stream_key_ciphertext = null,
      stream_key_iv = null,
      stream_key_last4 = p_new_stream_key_last4,
      credentials_version = p_new_credentials_version,
      status = 'waiting_signal',
      provider_error_code = null,
      updated_at = now()
  where id = p_source_id
    and provider_input_id = p_expected_provider_input_id
    and deleted_at is null
  returning provider into v_provider;

  if v_provider is null then return false; end if;

  insert into public.live_source_provider_cleanup_jobs (
    source_id, provider, provider_input_id, reason
  ) values (p_source_id, v_provider, p_expected_provider_input_id, 'rotation')
  on conflict (provider, provider_input_id, reason) do nothing;
  return true;
end;
$$;

create or replace function public.process_live_source_webhook(
  p_event_key text,
  p_provider_input_id text,
  p_event_type text,
  p_status text,
  p_updated_at timestamptz,
  p_error_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_id uuid;
  v_inserted integer;
begin
  select id into v_source_id
  from public.live_sources
  where provider_input_id = p_provider_input_id and deleted_at is null;
  if v_source_id is null then return false; end if;

  insert into public.live_source_webhook_events (event_key, source_id, event_type)
  values (p_event_key, v_source_id, p_event_type)
  on conflict (event_key) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return false; end if;

  update public.live_sources
  set status = p_status,
      updated_at = now(),
      last_provider_sync_at = p_updated_at,
      last_connected_at = case when p_status = 'live' then p_updated_at else last_connected_at end,
      last_disconnected_at = case when p_status = 'disconnected' then p_updated_at else last_disconnected_at end,
      provider_error_code = case when p_status = 'provider_error' then p_error_code else null end
  where id = v_source_id;
  return true;
end;
$$;

revoke all on function public.replace_live_source_input(uuid, text, text, text, text, text, integer) from public;
revoke all on function public.process_live_source_webhook(text, text, text, text, timestamptz, text) from public;
grant execute on function public.replace_live_source_input(uuid, text, text, text, text, text, integer) to service_role;
grant execute on function public.process_live_source_webhook(text, text, text, text, timestamptz, text) to service_role;

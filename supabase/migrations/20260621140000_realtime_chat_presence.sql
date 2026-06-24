alter table public.chat_rooms alter column stream_id drop not null;
alter table public.chat_rooms add column room_key text;
update public.chat_rooms set room_key = coalesce(stream_id::text, id::text) where room_key is null;
alter table public.chat_rooms alter column room_key set not null;
alter table public.chat_rooms add constraint chat_rooms_room_key_key unique (room_key);
alter table public.chat_rooms add constraint chat_rooms_room_key_length check (char_length(room_key) between 1 and 120);

alter table public.chat_messages add column channel text not null default 'community'
  check (channel in ('community', 'official'));
alter table public.chat_messages add column display_name_snapshot text not null default 'Usuario';
alter table public.chat_messages add column avatar_color_snapshot text not null default '142 70% 48%';

create index chat_rooms_room_key_idx on public.chat_rooms (room_key);
create index presence_sessions_expires_at_idx on public.presence_sessions (expires_at);
create index chat_messages_room_channel_created_idx
  on public.chat_messages (room_id, channel, created_at desc)
  where deleted_at is null;

create table public.chat_message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null default 'user_report' check (char_length(reason) between 3 and 500),
  created_at timestamptz not null default now(),
  unique (message_id, reporter_id)
);
create index chat_message_reports_created_idx on public.chat_message_reports (created_at desc);
create index chat_message_reports_reporter_idx on public.chat_message_reports (reporter_id);
alter table public.chat_message_reports enable row level security;
create policy chat_reports_insert_own on public.chat_message_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));
create policy chat_reports_staff_read on public.chat_message_reports for select to authenticated
  using ((select public.has_role(array['super_admin'::public.app_role, 'admin'::public.app_role, 'moderator'::public.app_role])));
grant insert, select on public.chat_message_reports to authenticated;

create table public.user_favorite_matches (
  user_id uuid not null references auth.users(id) on delete cascade,
  external_match_id text not null check (char_length(external_match_id) between 1 and 160),
  created_at timestamptz not null default now(),
  primary key (user_id, external_match_id)
);
create index user_favorite_matches_created_idx on public.user_favorite_matches (user_id, created_at desc);
alter table public.user_favorite_matches enable row level security;
create policy favorite_matches_manage_own on public.user_favorite_matches for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, delete on public.user_favorite_matches to authenticated;

insert into public.chat_rooms (room_key, slow_mode_seconds, enabled)
values ('global', 4, true)
on conflict (room_key) do nothing;

create or replace function public.ensure_chat_room(p_room_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  insert into public.chat_rooms (room_key, enabled)
  values (left(p_room_key, 120), true)
  on conflict (room_key) do update set room_key = excluded.room_key
  returning id into v_room_id;
  return v_room_id;
end;
$$;

revoke all on function public.ensure_chat_room(text) from public;
grant execute on function public.ensure_chat_room(text) to authenticated;

drop policy if exists chat_messages_insert on public.chat_messages;
revoke insert on public.chat_messages from authenticated;

create or replace function public.send_chat_message(
  p_room_key text,
  p_body text,
  p_channel text default 'community'
)
returns public.chat_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_room public.chat_rooms;
  v_profile public.profiles;
  v_message public.chat_messages;
begin
  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  if char_length(trim(p_body)) < 1 or char_length(trim(p_body)) > 500 then
    raise exception 'INVALID_MESSAGE' using errcode = '22023';
  end if;
  if p_channel not in ('community', 'official') then
    raise exception 'INVALID_CHANNEL' using errcode = '22023';
  end if;

  select * into v_profile from public.profiles where id = v_user_id and deleted_at is null;
  if v_profile.id is null or v_profile.account_status <> 'active' then
    raise exception 'ACCOUNT_NOT_ACTIVE' using errcode = '42501';
  end if;

  insert into public.chat_rooms (room_key, enabled)
  values (left(p_room_key, 120), true)
  on conflict (room_key) do nothing;
  select * into v_room from public.chat_rooms where room_key = left(p_room_key, 120) and enabled;
  if v_room.id is null then
    raise exception 'CHAT_DISABLED' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.chat_moderation_actions
    where room_id = v_room.id and target_user_id = v_user_id
      and action in ('mute', 'block') and (expires_at is null or expires_at > now())
  ) then
    raise exception 'CHAT_RESTRICTED' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.chat_messages
    where room_id = v_room.id and user_id = v_user_id
      and created_at > now() - make_interval(secs => v_room.slow_mode_seconds)
  ) then
    raise exception 'SLOW_MODE' using errcode = 'P0001';
  end if;

  if p_channel = 'official' and not public.has_role(array['super_admin'::public.app_role, 'admin'::public.app_role, 'moderator'::public.app_role]) then
    raise exception 'OFFICIAL_CHANNEL_FORBIDDEN' using errcode = '42501';
  end if;

  insert into public.chat_messages (room_id, user_id, body, channel, display_name_snapshot)
  values (v_room.id, v_user_id, trim(p_body), p_channel, v_profile.display_name)
  returning * into v_message;
  return v_message;
end;
$$;

revoke all on function public.send_chat_message(text, text, text) from public;
grant execute on function public.send_chat_message(text, text, text) to authenticated;

create or replace function public.heartbeat_presence(
  p_device_id uuid,
  p_tab_id uuid,
  p_state text default 'online',
  p_stream_id uuid default null
)
returns public.presence_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_presence public.presence_sessions;
begin
  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  if p_state not in ('online', 'watching', 'chatting') then
    raise exception 'INVALID_PRESENCE_STATE' using errcode = '22023';
  end if;
  delete from public.presence_sessions where expires_at <= now();
  insert into public.presence_sessions (
    user_id, stream_id, device_id, tab_id, state, last_heartbeat_at, expires_at
  ) values (
    v_user_id, p_stream_id, p_device_id, p_tab_id, p_state, now(), now() + interval '90 seconds'
  )
  on conflict (device_id, tab_id) do update set
    user_id = excluded.user_id,
    stream_id = excluded.stream_id,
    state = excluded.state,
    last_heartbeat_at = excluded.last_heartbeat_at,
    expires_at = excluded.expires_at
  returning * into v_presence;
  return v_presence;
end;
$$;

revoke all on function public.heartbeat_presence(uuid, uuid, text, uuid) from public;
grant execute on function public.heartbeat_presence(uuid, uuid, text, uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
    ) then
      execute 'alter publication supabase_realtime add table public.chat_messages';
    end if;
  end if;
end;
$$;

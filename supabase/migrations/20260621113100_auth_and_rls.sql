create or replace function public.has_role(requested_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role = any(requested_roles)
  );
$$;

revoke all on function public.has_role(public.app_role[]) from public;
grant execute on function public.has_role(public.app_role[]) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url, auth_provider)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_app_meta_data ->> 'provider'
  );
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.sports enable row level security;
alter table public.competitions enable row level security;
alter table public.teams enable row level security;
alter table public.matches enable row level security;
alter table public.streams enable row level security;
alter table public.stream_sources enable row level security;
alter table public.stream_ingest_secrets enable row level security;
alter table public.presence_sessions enable row level security;
alter table public.activity_events enable row level security;
alter table public.analytics_daily enable row level security;
alter table public.sponsors enable row level security;
alter table public.sponsor_impressions enable row level security;
alter table public.sponsor_clicks enable row level security;
alter table public.chat_rooms enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_moderation_actions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.app_settings enable row level security;

create policy profiles_read_self on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_admin_read on public.profiles for select to authenticated using ((select public.has_role(array['super_admin'::public.app_role, 'admin'::public.app_role])));

create policy roles_read_self on public.user_roles for select to authenticated using (user_id = (select auth.uid()));
create policy roles_super_admin_manage on public.user_roles for all to authenticated
using ((select public.has_role(array['super_admin'::public.app_role])))
with check ((select public.has_role(array['super_admin'::public.app_role])));

create policy sports_public_read on public.sports for select to anon, authenticated using (active);
create policy competitions_public_read on public.competitions for select to anon, authenticated using (active);
create policy teams_public_read on public.teams for select to anon, authenticated using (true);
create policy matches_public_read on public.matches for select to anon, authenticated using (deleted_at is null);
create policy sports_admin_manage on public.sports for all to authenticated using ((select public.has_role(array['super_admin'::public.app_role, 'admin'::public.app_role]))) with check ((select public.has_role(array['super_admin'::public.app_role, 'admin'::public.app_role])));
create policy competitions_admin_manage on public.competitions for all to authenticated using ((select public.has_role(array['super_admin'::public.app_role, 'admin'::public.app_role]))) with check ((select public.has_role(array['super_admin'::public.app_role, 'admin'::public.app_role])));
create policy teams_admin_manage on public.teams for all to authenticated using ((select public.has_role(array['super_admin'::public.app_role, 'admin'::public.app_role]))) with check ((select public.has_role(array['super_admin'::public.app_role, 'admin'::public.app_role])));
create policy matches_admin_manage on public.matches for all to authenticated using ((select public.has_role(array['super_admin'::public.app_role, 'admin'::public.app_role]))) with check ((select public.has_role(array['super_admin'::public.app_role, 'admin'::public.app_role])));

create policy streams_public_read on public.streams for select to anon, authenticated using (deleted_at is null and status in ('scheduled', 'live', 'ended') and visibility = 'public');
create policy streams_authenticated_read on public.streams for select to authenticated using (deleted_at is null and status in ('scheduled', 'live', 'ended') and visibility = 'authenticated');
create policy streams_admin_manage on public.streams for all to authenticated using ((select public.has_role(array['super_admin'::public.app_role, 'admin'::public.app_role]))) with check ((select public.has_role(array['super_admin'::public.app_role, 'admin'::public.app_role])));
create policy stream_sources_public_read on public.stream_sources for select to anon, authenticated using (enabled and exists (select 1 from public.streams where streams.id = stream_id and streams.deleted_at is null and streams.status in ('scheduled', 'live', 'ended') and streams.visibility = 'public'));
create policy stream_sources_admin_manage on public.stream_sources for all to authenticated using ((select public.has_role(array['super_admin'::public.app_role, 'admin'::public.app_role]))) with check ((select public.has_role(array['super_admin'::public.app_role, 'admin'::public.app_role])));
create policy ingest_super_admin_manage on public.stream_ingest_secrets for all to authenticated using ((select public.has_role(array['super_admin'::public.app_role]))) with check ((select public.has_role(array['super_admin'::public.app_role])));

create policy presence_manage_own on public.presence_sessions for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy activity_insert_authenticated on public.activity_events for insert to authenticated with check (user_id = (select auth.uid()));
create policy analytics_admin_read on public.analytics_daily for select to authenticated using ((select public.has_role(array['super_admin'::public.app_role, 'admin'::public.app_role])));

create policy sponsors_public_read on public.sponsors for select to anon, authenticated using (deleted_at is null and status = 'active' and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));
create policy sponsors_admin_manage on public.sponsors for all to authenticated using ((select public.has_role(array['super_admin'::public.app_role, 'admin'::public.app_role]))) with check ((select public.has_role(array['super_admin'::public.app_role, 'admin'::public.app_role])));
create policy sponsor_impressions_insert on public.sponsor_impressions for insert to anon, authenticated with check (visible_ratio >= 0.5 and (user_id is null or user_id = (select auth.uid())));
create policy sponsor_clicks_insert on public.sponsor_clicks for insert to anon, authenticated with check (user_id is null or user_id = (select auth.uid()));
create policy sponsor_metrics_admin_read on public.sponsor_impressions for select to authenticated using ((select public.has_role(array['super_admin'::public.app_role, 'admin'::public.app_role])));
create policy sponsor_clicks_admin_read on public.sponsor_clicks for select to authenticated using ((select public.has_role(array['super_admin'::public.app_role, 'admin'::public.app_role])));

create policy chat_rooms_read on public.chat_rooms for select to anon, authenticated using (enabled);
create policy chat_messages_read on public.chat_messages for select to authenticated using (deleted_at is null);
create policy chat_messages_insert on public.chat_messages for insert to authenticated with check (user_id = (select auth.uid()) and deleted_at is null);
create policy chat_messages_delete_own on public.chat_messages for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy chat_messages_moderate on public.chat_messages for update to authenticated using ((select public.has_role(array['super_admin'::public.app_role, 'admin'::public.app_role, 'moderator'::public.app_role]))) with check ((select public.has_role(array['super_admin'::public.app_role, 'admin'::public.app_role, 'moderator'::public.app_role])));
create policy moderation_staff_manage on public.chat_moderation_actions for all to authenticated using ((select public.has_role(array['super_admin'::public.app_role, 'admin'::public.app_role, 'moderator'::public.app_role]))) with check ((select public.has_role(array['super_admin'::public.app_role, 'admin'::public.app_role, 'moderator'::public.app_role])));

create policy audit_super_admin_read on public.audit_logs for select to authenticated using ((select public.has_role(array['super_admin'::public.app_role])));
create policy settings_public_read on public.app_settings for select to anon, authenticated using (key = any(array['platform_name', 'logo_url', 'favicon_url', 'default_poster', 'offline_message']));
create policy settings_super_admin_manage on public.app_settings for all to authenticated using ((select public.has_role(array['super_admin'::public.app_role]))) with check ((select public.has_role(array['super_admin'::public.app_role])));

grant usage on schema public to anon, authenticated;
grant select on public.sports, public.competitions, public.teams, public.matches, public.streams, public.stream_sources, public.sponsors, public.chat_rooms, public.app_settings to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.user_roles, public.analytics_daily, public.audit_logs to authenticated;
grant insert, select, update, delete on public.presence_sessions, public.chat_messages, public.chat_moderation_actions to authenticated;
grant insert on public.activity_events to authenticated;
grant insert, select on public.sponsor_impressions, public.sponsor_clicks to anon, authenticated;
grant insert, select, update, delete on public.sports, public.competitions, public.teams, public.matches, public.streams, public.stream_sources, public.stream_ingest_secrets, public.sponsors, public.app_settings to authenticated;


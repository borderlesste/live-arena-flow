-- Guests may read the public chat, but every write remains behind authenticated RPCs.
drop policy if exists chat_messages_read on public.chat_messages;
create policy chat_messages_read on public.chat_messages
  for select to anon, authenticated
  using (deleted_at is null);
grant select on public.chat_messages to anon;

-- Do not rewrite existing profile data blindly. NOT VALID still protects new and updated rows.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_display_name_safe'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_display_name_safe
      check (display_name !~ '[<>[:cntrl:]]') not valid;
  end if;
end;
$$;

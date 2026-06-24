do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_rooms'
    ) then
      execute 'alter publication supabase_realtime add table public.chat_rooms';
    end if;
  end if;
end;
$$;

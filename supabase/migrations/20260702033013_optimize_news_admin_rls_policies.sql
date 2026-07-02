drop policy if exists news_admin_manage on public.news;

drop policy if exists news_admin_insert on public.news;
create policy news_admin_insert on public.news
  for insert to authenticated
  with check ((select public.has_role(array['super_admin'::public.app_role, 'admin'::public.app_role])));

drop policy if exists news_admin_update on public.news;
create policy news_admin_update on public.news
  for update to authenticated
  using ((select public.has_role(array['super_admin'::public.app_role, 'admin'::public.app_role])))
  with check ((select public.has_role(array['super_admin'::public.app_role, 'admin'::public.app_role])));

drop policy if exists news_admin_delete on public.news;
create policy news_admin_delete on public.news
  for delete to authenticated
  using ((select public.has_role(array['super_admin'::public.app_role, 'admin'::public.app_role])));

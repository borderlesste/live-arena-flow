alter table public.sponsors
  add column if not exists image text,
  alter column logo_url drop not null;

alter table public.sponsors
  drop constraint if exists sponsors_image_data_url_check;

alter table public.sponsors
  add constraint sponsors_image_data_url_check check (
    image is null
    or (
      char_length(image) <= 700000
      and image ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$'
    )
  );

create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  category text not null check (char_length(category) between 1 and 60),
  excerpt text not null check (char_length(excerpt) between 1 and 400),
  body text check (body is null or char_length(body) <= 20000),
  image text,
  cover_image_url text,
  published_at timestamptz not null default now(),
  image_hue integer not null default 0 check (image_hue between 0 and 360),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint news_image_data_url_check check (
    image is null
    or (
      char_length(image) <= 700000
      and image ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$'
    )
  )
);

create index if not exists news_published_at_idx
  on public.news (published_at desc)
  where deleted_at is null;

drop trigger if exists news_set_updated_at on public.news;
create trigger news_set_updated_at
  before update on public.news
  for each row execute function public.set_updated_at();

alter table public.news enable row level security;

drop policy if exists news_public_read on public.news;
create policy news_public_read on public.news
  for select to anon, authenticated
  using (deleted_at is null and published_at <= now());

drop policy if exists news_admin_manage on public.news;
create policy news_admin_manage on public.news
  for all to authenticated
  using ((select public.has_role(array['super_admin'::public.app_role, 'admin'::public.app_role])))
  with check ((select public.has_role(array['super_admin'::public.app_role, 'admin'::public.app_role])));

grant select on public.news to anon, authenticated;
grant insert, select, update, delete on public.news to authenticated;

alter table public.news
  add column if not exists is_sponsored boolean not null default false,
  add column if not exists sponsor_name text;

alter table public.news
  drop constraint if exists news_sponsor_name_check;

alter table public.news
  add constraint news_sponsor_name_check check (
    (is_sponsored = false and sponsor_name is null)
    or (
      is_sponsored = true
      and sponsor_name is not null
      and char_length(btrim(sponsor_name)) between 1 and 120
    )
  );

comment on column public.news.is_sponsored is
  'Identifies paid editorial content that requires a clear public disclosure.';

comment on column public.news.sponsor_name is
  'Public-facing sponsor name shown next to the sponsored-content disclosure.';

alter table public.sponsors
  add column if not exists sponsor_type text not null default 'partner',
  add column if not exists enabled_devices text[] not null default array['mobile', 'tablet', 'desktop', 'tv']::text[],
  add column if not exists placement text not null default 'homepage',
  add column if not exists campaign text,
  add column if not exists competition_id uuid references public.competitions(id) on delete set null,
  add column if not exists match_id uuid references public.matches(id) on delete set null,
  add column if not exists stream_id uuid references public.streams(id) on delete set null,
  add column if not exists utm jsonb not null default '{}'::jsonb,
  add column if not exists max_impressions bigint check (max_impressions is null or max_impressions > 0),
  add column if not exists max_clicks bigint check (max_clicks is null or max_clicks > 0);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sponsors_sponsor_type_check'
      and conrelid = 'public.sponsors'::regclass
  ) then
    alter table public.sponsors
      add constraint sponsors_sponsor_type_check
      check (sponsor_type in ('main', 'official', 'partner'));
  end if;
end;
$$;

create index if not exists sponsors_campaign_idx on public.sponsors (campaign) where deleted_at is null;
create index if not exists sponsors_stream_idx on public.sponsors (stream_id) where deleted_at is null;
create index if not exists sponsors_competition_idx on public.sponsors (competition_id) where deleted_at is null;

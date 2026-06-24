alter table public.sponsors
  add column sponsor_type text not null default 'partner' check (sponsor_type in ('main', 'official', 'partner')),
  add column enabled_devices text[] not null default array['mobile', 'tablet', 'desktop', 'tv']::text[],
  add column placement text not null default 'homepage',
  add column campaign text,
  add column competition_id uuid references public.competitions(id) on delete set null,
  add column match_id uuid references public.matches(id) on delete set null,
  add column stream_id uuid references public.streams(id) on delete set null,
  add column utm jsonb not null default '{}'::jsonb,
  add column max_impressions bigint check (max_impressions is null or max_impressions > 0),
  add column max_clicks bigint check (max_clicks is null or max_clicks > 0);

create index sponsors_campaign_idx on public.sponsors (campaign) where deleted_at is null;
create index sponsors_stream_idx on public.sponsors (stream_id) where deleted_at is null;
create index sponsors_competition_idx on public.sponsors (competition_id) where deleted_at is null;

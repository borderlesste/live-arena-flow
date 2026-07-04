-- Long-term, server-owned storage for Cloudflare Web Analytics aggregates.
-- Cloudflare retains Web Analytics for six months; these daily rows preserve
-- historical totals without storing IP addresses, user agents or identities.

create table if not exists public.web_analytics_daily (
  day date not null,
  site_tag text not null,
  hostname text not null,
  visits bigint not null default 0 check (visits >= 0),
  page_views bigint not null default 0 check (page_views >= 0),
  sample_interval numeric not null default 1 check (sample_interval > 0),
  source text not null default 'cloudflare' check (source = 'cloudflare'),
  synced_at timestamptz not null default now(),
  primary key (day, site_tag, hostname)
);

create index if not exists web_analytics_daily_day_idx
  on public.web_analytics_daily (day desc);

alter table public.web_analytics_daily enable row level security;

revoke all on public.web_analytics_daily from public, anon, authenticated;
grant all on public.web_analytics_daily to service_role;

comment on table public.web_analytics_daily is
  'Daily privacy-preserving visit and page-view aggregates imported from Cloudflare Web Analytics.';

-- Enforce case-insensitive uniqueness at the database boundary. The aggregate
-- production audit found no pre-existing duplicates before this migration.
create unique index if not exists profiles_display_name_unique_ci
  on public.profiles (lower(normalize(btrim(display_name), NFKC)))
  where deleted_at is null;

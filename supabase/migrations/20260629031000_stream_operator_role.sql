-- Dedicated least-privilege role for the backend live-source management API.
-- Keep this migration separate: PostgreSQL enum values must be committed before use.
alter type public.app_role add value if not exists 'stream_operator' after 'admin';

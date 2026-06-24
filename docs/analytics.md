# Analytics and presence

Authenticated presence now uses a shared Supabase Realtime channel keyed by stable device ID, plus a server-owned `heartbeat_presence` RPC that upserts a 90-second database lease. Multiple UI instances share one channel and heartbeat, and tabs are tracked separately without inflating the device count. Provider viewer numbers are not treated as platform presence.

Sponsor impressions and clicks are idempotent database events; impressions require at least 60% visibility for one second. Periodic analytics aggregates, retention jobs and playback-event ingestion remain pending.

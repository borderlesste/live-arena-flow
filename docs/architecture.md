# Architecture

Arena Live currently runs as two TypeScript processes: a React/Vite SPA in `src/` and a Node HTTP API in `server/`. The API is the only process allowed to call sports providers or retain OBS ingest data.

Versioned migrations under `supabase/migrations` define the PostgreSQL target, Auth-linked profiles, roles, streams, presence, analytics, sponsors, chat and audit data with RLS. Supabase Auth is used when configured; production disables the local auth adapter. Sports data is isolated behind `SportsProvider`.

Chat rooms/messages, reports, favorites, sponsor reads/telemetry and presence now use Supabase directly when configured. Chat writes go through security-definer RPCs that enforce account state, moderation restrictions, slow mode and official-channel roles. Realtime subscriptions are shared and cleaned up when unused.

The remaining JSON store still backs editorial news/highlights and administrative stream CRUD, and must be replaced by Supabase repositories. Background synchronization, analytics aggregation and shared observability remain production work.

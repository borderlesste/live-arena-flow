# Production implementation phases

1. Stabilize the current application: remove simulated controls, validate contracts, protect secrets, and establish CI quality gates.
2. Introduce Supabase: versioned schema, Auth/OAuth, role claims, RLS, Storage and Realtime chat/presence.
3. Modularize the API: domain services, structured errors/logging, rate limits, audit trail and a provider-neutral `SportsProvider` with SportSRC.
4. Complete streaming operations: normalized sources, diagnostics protected against SSRF, scheduling, primary/fallback rules, telemetry and viewer sessions.
5. Complete sponsors and analytics: campaigns, visible impressions, clicks, aggregates, retention and LGPD controls.
6. Production hardening: integration/E2E tests, Render workers/cron, Vercel routing, Cloudflare policies, observability and recovery drills.

Phases 2-6 require provisioned Supabase, SportSRC, OAuth and streaming-provider resources. They cannot be validated solely from this checkout.

## Current status

- Phase 1: implemented and validated.
- Phase 2: schema, RLS, Auth, Google/recovery, role checks, Realtime chat, secure chat RPCs, presence heartbeat, reports and favorites implemented; live Supabase provisioning and Storage validation remain.
- Phase 3: provider-neutral sports layer implemented; modularization of the remaining API domains, jobs and audit logging remains.
- Phase 4: Realtime chat/presence foundation implemented; stream diagnostics, playback telemetry and viewer sessions remain.
- Phase 5: sponsor impressions/clicks implemented; campaigns, aggregates and exports remain.
- Phase 6: pending.

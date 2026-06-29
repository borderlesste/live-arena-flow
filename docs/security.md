# Security

The API validates bodies with Zod, limits body size, hashes passwords and session tokens, applies exact-origin CORS and sends restrictive API headers. Embed URLs are allowlisted in the frontend. OBS keys are excluded from responses and encrypted at rest when configured. Contact-form logging avoids raw email output.

Production refuses the default admin token, requires a stream encryption key of at least 32 characters, and validates the Cloudflare webhook secret when that provider is selected. The stabilization migration restricts profile columns, moves chat mutations to role-checked RPCs, removes normal-user metrics/raw-live-source access, and adds atomic webhook deduplication plus provider cleanup jobs.

Applying the migration, rotating the exposed webhook secret, validating Supabase RLS in the hosted project, and testing Cloudflare/OBS with real credentials remain deployment blockers.

## Dependency audit (2026-06-28)

`npm audit --omit=dev --audit-level=high` reports two moderate instances of GHSA-qx2v-qp2m-jg93 in Next.js' nested build-time PostCSS. The suggested forced fix would downgrade Next to 9.3.3 and is rejected as unsafe. The application does not accept attacker-supplied CSS for server-side stringification; track the upstream Next.js dependency and upgrade when it ships a compatible PostCSS fix.

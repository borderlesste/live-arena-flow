# Sponsors

`/admin/sponsors` is restricted to `super_admin` and `admin`. It supports create, edit, soft delete, activation, pause, scheduling, duplication, device targeting, campaign metadata, UTM values, impression/click limits and drag-and-drop priority ordering.

With Supabase configured, the panel writes directly to the RLS-protected `sponsors` table. Without Supabase, the protected Render API provides a development fallback. Public reads include only active sponsors inside their configured date window.

The homepage slider uses managed logo URLs, pauses during hover, focus and hidden tabs, and respects reduced motion. An impression is persisted only after at least 60% visibility for one second. Clicks and impressions use idempotency keys; the admin panel displays impressions, clicks and CTR.

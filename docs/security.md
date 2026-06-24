# Security

The API validates bodies with Zod, limits body size, hashes passwords and session tokens, applies exact-origin CORS and sends restrictive API headers. Embed URLs are allowlisted in the frontend. OBS keys are excluded from responses and encrypted at rest when configured. Contact-form logging avoids raw email output.

Production refuses the default admin token, requires a stream encryption key of at least 32 characters, and refuses to start without a configured sports provider. Cloudflare controls, Supabase RLS deployment verification, CSRF review, upload validation and role authorization review remain deployment blockers.

# Authentication

The frontend uses Supabase Auth for email registration and login, Google OAuth, confirmation redirects, password recovery, password updates, persisted sessions and token refresh. It prefers `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; when Vercel does not define them, the Server Component retrieves the browser-safe configuration from the backend `/api/config/public` endpoint. Profiles and roles come from the RLS-protected `profiles` and `user_roles` tables.

The Render API validates the Supabase bearer token and reads roles through RLS before every administrative mutation. Frontend route guards improve UX but are never the authorization boundary.

The legacy JSON auth endpoints are development/test compatibility only. Production frontend builds never call them, and the backend keeps them disabled with `LEGACY_AUTH_ENABLED=false`.

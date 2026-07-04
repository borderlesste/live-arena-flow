# Authentication

The frontend uses Supabase Auth for email registration and login, Google OAuth, confirmation redirects, password recovery, password updates, persisted sessions and token refresh. It prefers `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; when Vercel does not define them, the Server Component retrieves the browser-safe configuration from the backend `/api/config/public` endpoint. Profiles and roles come from the RLS-protected `profiles` and `user_roles` tables.

The Render API validates the Supabase bearer token and reads roles through RLS before every administrative mutation. Frontend route guards improve UX but are never the authorization boundary.

The legacy JSON auth endpoints are development/test compatibility only. Production frontend builds never call them, and the backend keeps them disabled with `LEGACY_AUTH_ENABLED=false`.

## Production email redirects

Resend is the SMTP transport for Supabase Auth; Supabase constructs confirmation and recovery links. The frontend requests these exact destinations:

- signup and resend: `https://www.luisromerofutbol.com/auth/confirm`
- password recovery: `https://www.luisromerofutbol.com/auth/update-password`
- Google OAuth: `https://www.luisromerofutbol.com/profile`

Configure **Supabase Dashboard -> Authentication -> URL Configuration** as follows:

- Site URL: `https://www.luisromerofutbol.com`
- Redirect URLs: add each of the three exact URLs above
- keep `http://localhost:8080/**` only as an additional development redirect, never as Site URL

Supabase falls back to Site URL when a requested redirect is absent from the allow list. Therefore a production email that lands on `localhost` indicates dashboard URL configuration, not a Resend SDK problem.

Vercel Production must also define `NEXT_PUBLIC_APP_URL=https://www.luisromerofutbol.com` and be redeployed after changing it. The client rejects a loopback `NEXT_PUBLIC_APP_URL` when the request originates from a public host, preventing a local `.env` value from leaking into newly generated email links.

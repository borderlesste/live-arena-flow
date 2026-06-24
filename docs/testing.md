# Testing

Run `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e` and `npm run build`.

Unit coverage includes sports normalization/resilience, match search and stream validation. PostgreSQL-embedded tests execute schema/RLS/Realtime migrations and verify sensitive-table coverage. Playwright smoke tests cover the public app, protected admin routes, API-backed match rendering, dedicated live API rendering and mobile player overlays.

OAuth, remote Realtime, Storage and deployed streaming sources require provisioned infrastructure before they can be claimed as verified.

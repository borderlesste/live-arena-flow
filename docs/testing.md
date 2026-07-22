# Testing

Run `npm run release:gate` before publishing. It is the canonical local/release gate and executes Node 24 parity, production dependency audit, lint, typecheck, unit/integration tests, `next build` and Playwright smoke E2E.

Unit coverage includes sports normalization/resilience, match search and stream validation. PostgreSQL-embedded tests execute schema/RLS/Realtime migrations and verify sensitive-table coverage. Playwright smoke tests cover maintenance mode, protected admin bypass, API-backed match rendering, dedicated live API rendering and mobile player overlays.

OAuth, remote Realtime, Storage and deployed streaming sources require provisioned infrastructure before they can be claimed as verified.

# Sports data provider

Only the backend calls sports providers. `SportsProvider` normalizes responses before they cross the API boundary, caches date windows, applies timeouts, retries 429/5xx failures and opens a circuit after repeated failures. The frontend no longer imports TheSportsDB response types.

The TheSportsDB adapter requests Soccer, Basketball, Baseball and Volleyball explicitly for each date, normalizes provider states and deduplicates event IDs. This prevents the small unfiltered `eventsday.php` subset from leaving frontend sport and status filters empty.

Select `SPORTS_PROVIDER=thesportsdb` or `sportsdataio`. SportsDataIO uses `GamesByDate/{date}`, dates formatted as `YYYY-MMM-DD`, and `Ocp-Apim-Subscription-Key` by default. The paths and authentication header remain configurable through `SPORTSRC_EVENTS_PATH`, `SPORTSRC_EVENT_PATH` and `SPORTSRC_AUTH_HEADER`.

Run `npm run sportsdataio:check -- YYYY-MM-DD` before activating the provider. The command never prints the key. A configured `SPORTSRC_API_KEY` remains inactive until `SPORTS_PROVIDER=sportsdataio` is set; do this only after the check succeeds. Scheduled synchronization and durable quota accounting remain pending.

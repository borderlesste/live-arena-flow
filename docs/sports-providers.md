# SportSRC Provider

## Active Contract

The backend exposes normalized SportSRC V2 data through `server/modules/sports`. The frontend consumes only `/api/sports/events`, `/api/sports/live`, and `/api/sports/events/:id`; it never receives the license key or provider-native envelopes. `/api/sports/events` accepts either `date=YYYY-MM-DD` or an inclusive, bounded `start=YYYY-MM-DD&end=YYYY-MM-DD` range (maximum 62 days).

```ts
interface SportsProvider {
  readonly name: string;
  eventsByDate(date: string): Promise<NormalizedSportsEvent[]>;
  liveEvents(): Promise<NormalizedSportsEvent[]>;
  eventById(id: string): Promise<NormalizedSportsEvent | undefined>;
}
```

## Data Matrix

| Data | SportSRC V2 query | Cache |
| --- | --- | --- |
| Matches and results | `type=matches&sport=football&date=YYYY-MM-DD` | 5 minutes |
| Bounded ranges | One cached daily query per UTC date, with four concurrent workers | 5 minutes per day |
| Live matches | `type=matches&sport=football&status=inprogress` | 60 seconds |
| Match detail | `type=detail&id={match_id}` | No list cache |
| Teams and leagues | Derived from grouped match payloads | Same as matches |
| Managed OBS streams | Application data, independent from provider embeds | N/A |

## Security

- `SPORTSRC_API_KEY` is server-only and sent using `X-API-KEY`.
- The base URL is fixed to `https://api.sportsrc.org/v2/` to prevent configuration drift and SSRF.
- The backend validates every provider response before normalization.
- Range input is validated and bounded to prevent unbounded provider fan-out.
- Run `npm run sportsrc:check -- YYYY-MM-DD` after changing the license.

## Pending Hardening

- Persist normalized match snapshots in Supabase to reduce quota usage.
- Add account quota metrics without exposing license or account identity.
- Add scheduled synchronization only after deployment ownership is defined.

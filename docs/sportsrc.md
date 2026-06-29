# SportSRC V2

SportSRC V2 is the only sports data provider. The backend uses the fixed endpoint `https://api.sportsrc.org/v2/`, authenticates with `X-API-KEY`, validates the `success/data` envelope and converts provider-native data to `NormalizedSportsEvent`.

Required environment variable:

```text
SPORTSRC_API_KEY=
```

Supported operations:

- Date schedule: `type=matches&sport=football&date=YYYY-MM-DD`.
- Live status: `type=matches&sport=football&status=inprogress`.
- Match detail: `type=detail&id={match_id}`.

The in-memory cache keeps date windows for five minutes and live results for one minute. Run the non-secret validation command after rotating the license:

```powershell
npm.cmd run sportsrc:check -- 2026-06-29
```

Official documentation: <https://www.sportsrc.org/v2/#docs>.

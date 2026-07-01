# Restream integration

The backend can use Restream as the OBS publishing destination with `STREAM_PROVIDER=restream`.

## API mode

1. Create an application in the Restream developer portal.
2. Authorize it with the minimum scopes `channels.read` and `stream.read`.
3. Exchange the authorization code server-side.
4. Configure the resulting access token as `RESTREAM_ACCESS_TOKEN` in Render.

The provider reads the selected ingest from `GET /v2/user/ingest`, the publishing key from `GET /v2/user/streamKey`, and the server URL from `GET /v2/server/all`. Access tokens expire after one hour; until encrypted refresh-token persistence is implemented, rotate the configured access token or use static mode for unattended production operation.

## Static mode

Configure both values only in the backend environment:

```text
RESTREAM_INGEST_URL=rtmps://live.restream.io:1937/live
RESTREAM_STREAM_KEY=
```

Never place the stream key in a `NEXT_PUBLIC_*` variable, browser storage, logs, screenshots, or commits.

## Playback limitation

Restream distributes an incoming stream to configured destinations. This integration does not treat the Restream publishing key as a playback URL. To show the stream on this website, configure an independent HTTPS HLS or supported embed URL.

## Restream to Cloudflare HLS bridge

Set `STREAM_PROVIDER=restream_cloudflare` and configure both the Restream static credentials and all Cloudflare Stream variables. Creating an OBS source then:

1. Returns the Restream RTMPS server and key for OBS.
2. Creates a unique Cloudflare Live Input with automatic recording and an HLS playback URL.
3. Returns the Cloudflare RTMPS destination credentials only to an authorized administrator.
4. Requires the administrator to add those Cloudflare credentials as an enabled Custom RTMP channel in Restream.

The Cloudflare destination key is never included in public video-source responses. Rotating the source creates a new Cloudflare Live Input, so the Custom RTMP channel in Restream must be updated with the newly revealed destination credentials.

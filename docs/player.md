# Player

HLS uses native browser support or `hls.js`; HTML5 media uses the browser element; approved embeds use sandboxed iframes. RTMP and SRT are never loaded in the browser.

When an HLS or HTML5 source fails, the player advances to the next ordered source. Play, pause, volume, Picture-in-Picture, sharing and fullscreen operate on real media. Third-party embeds retain provider controls.


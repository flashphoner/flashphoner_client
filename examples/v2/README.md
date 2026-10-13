# WEB SDK examples v2

## Media Devices

Serve the SDK directory over HTTP or HTTPS with the built `flashphoner.js` at
its root, then open `examples/v2/streaming/media_devices_manager/media_device_manager.html`.

- `media-device-manager.js` contains the Flashphoner session and stream logic.
- `bitrate-chart.js` draws the bitrate comparison using the Canvas API.
- `stream-statistics.js` pairs Local and Player metrics in a single table without summing them.
- `manager.css` owns the complete layout and visual styling.

Statistics show `No data` for an absent measurement and `N/A` for a metric
that does not apply to that side. Local is publishing; Player is playback.
Use each metric's `?` popup for its Local/Player meaning and units.

## Shared modules

The examples import ES modules from `dependencies/js`:

- `dom.js`: explicit DOM operations using native browser APIs.
- `server-url.js`: shared port configuration and WebSocket, HLS, REST, and admin URLs.
- `media.js`: aspect-ratio-preserving sizing for video and canvas elements.
- `identifiers.js`: short random stream names.
- `tooltips.js`: help popovers for mouse, keyboard, and touch.

## Server ports

Edit `dependencies/ports.js` for nonstandard WCS ports. Load this classic
script before the example's ES module. It uses the same configuration keys
and defaults as the original examples:

| URL helper | HTTP page | HTTPS page |
|---|---|---|
| `getWebsocketUrl()` | `ws`: 8080 | `wss`: 8443 |
| `getHLSUrl()` | `hls.http`: 8082 | `hls.https`: 8445 |
| `getRestUrl()` | `http`: 8081 | `https`: 8444 |
| `getAdminUrl()` | `legacy.http`: 9091 | `legacy.https`: 8888 |

All URL helpers accept `(hostName, hostPort, ports)` overrides. Otherwise
they use the page hostname, protocol, and the `SERVER_PORTS` global.
`getPortsConfig(ports)` returns a new configuration with missing values filled
from the defaults, including nested `hls` and `legacy` values. It does not
modify the supplied configuration or the defaults.

## Regression checks

Run these checks manually from the repository root with Node.js 20 or later:

```sh
npm run test:examples
```

These checks are not part of the Grunt build tasks. Node.js 20 or later is
required only on the machine running the checks, not on the build agents.

These checks use built-in Node APIs and mocked browser objects; they do not
access a camera, microphone, or WCS. Real-browser media checks remain separate.

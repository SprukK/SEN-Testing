# SEN Lab (BLE Probe) tests

Run all five before every release. Install the test dependencies **outside** the repo so no `node_modules` gets committed:

```bash
npm install jsdom fake-indexeddb --prefix /tmp/jsdom
```

| File | What it checks | Expected on V1.4.0 |
|---|---|---|
| `probetest.js` | Real-DOM (jsdom) click test against simulated devices running concurrently: two Calypsos (one streaming, one unlisted unit answering `:NA` to every known token), FX Pocket Pro, FX True Ballistic, FX Pocket V2 broadcast, generic device — handshake, shot parsing and stats, log filter, disconnect/reconnect, export. Recovered verbatim from the V1.1.0 build session (2026-10-18). | ALL PASS (25 checks) |
| `capturetest.js` | Tabs + capture (V1.3.0, LAB-03): four tabs as one page (devices stay connected, tab remembered), status strip, FX angle-test session with markers, byte-change detection since the last marker, decoding unaffected, unticked devices not recorded, read all, GATT dump, stop, JSON + text export, never writes to a device, no HTML sinks | PASS 20 / FAIL 0 |
| `unlocktest.js` | Per-unit Calypso `:DU` unlock (V1.3.1): each known unit sends only its own token, both stream together, keepalive accepted after unlock, unlisted unit falls back through known tokens, no-token hint, empty battery service retried | ALL PASS (13) |
| `lanetest.js` | Wind lane (V1.4.0): lane physics matches the lag-time rule for uniform wind, symmetry, near-muzzle wind weighs more, head/tailwind, Calypso wind convention, nearest/blend station mapping, equal stations = uniform wind, station shares add up, live Calypso feed + stale drop, gusts, Lane tab start/stop, settings clamped on load, no HTML sinks | PASS 23 / FAIL 0 |
| `maindatatest.js` | CORE-09 (V1.2.0): the real Lab page and the real Main calculator in two jsdom windows sharing one IndexedDB — no Main data → message and no database created; Main saves → identical counts and active session; Main's data unchanged and no upgrade blocked; chrono average vs profile MV; re-read on return; localStorage fallback; newer schema refused; unreadable data reported | PASS 13 / FAIL 0 |

```bash
cd tests
NODE_PATH=/tmp/jsdom/node_modules node probetest.js ../index.html
NODE_PATH=/tmp/jsdom/node_modules node capturetest.js ../index.html
NODE_PATH=/tmp/jsdom/node_modules node unlocktest.js ../index.html
NODE_PATH=/tmp/jsdom/node_modules node lanetest.js ../index.html
# needs a checkout of SprukK/SEN-Balistic-Calculator next to this repo
NODE_PATH=/tmp/jsdom/node_modules node maindatatest.js ../index.html ../../sen-balistic-calculator/index.html
```

`maindatatest.js` must also be re-run whenever Main changes its storage names or snapshot shape (storage contract next to `IDB_NAME` in Main's `index.html`).

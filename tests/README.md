# SEN Lab (BLE Probe) tests

Run all nine before every release. Install the test dependencies **outside** the repo so no `node_modules` gets committed:

```bash
npm install jsdom fake-indexeddb --prefix /tmp/jsdom
```

| File | What it checks | Expected on V1.7.0 |
|---|---|---|
| `probetest.js` | Real-DOM (jsdom) click test against simulated devices running concurrently: two Calypsos (one streaming, one unlisted unit answering `:NA` to every known token), FX Pocket Pro, FX True Ballistic, FX Pocket V2 broadcast, generic device — handshake, shot parsing and stats, log filter, disconnect/reconnect, export. Recovered verbatim from the V1.1.0 build session (2026-10-18). | ALL PASS (25 checks) |
| `capturetest.js` | Tabs + capture (V1.3.0, LAB-03): four tabs as one page (devices stay connected, tab remembered), status strip, FX angle-test session with markers, byte-change detection since the last marker, decoding unaffected, unticked devices not recorded, read all, GATT dump, stop, JSON + text export, never writes to a device, no HTML sinks | PASS 20 / FAIL 0 |
| `unlocktest.js` | Per-unit Calypso `:DU` unlock (V1.3.1): each known unit sends only its own token, both stream together, keepalive accepted after unlock, unlisted unit falls back through known tokens, no-token hint, empty battery service retried | ALL PASS (13) |
| `lanetest.js` | Wind lane (V1.4.0): lane physics matches the lag-time rule for uniform wind, symmetry, near-muzzle wind weighs more, head/tailwind, Calypso wind convention, nearest/blend station mapping, equal stations = uniform wind, station shares add up, live Calypso feed + stale drop, gusts, Lane tab start/stop, settings clamped on load, no HTML sinks | PASS 23 / FAIL 0 |
| `rftest.js` | Rangefinder prep (V1.5.0, LAB-04/05): Chrome-like simulated browser (unnamed services hidden) — wide service net in the chooser (780 services, off when unticked), binary FFE0 rangefinder reachable through it, ASCII rangefinder on an unlisted 128-bit service hidden until its advertised UUID is added with one tap (kept for next time), Rangefinder capture preset, Mark range markers, number finder (uint16 LE ×10 distance at bytes 2–3, int16 LE ×10 angle, ASCII text, yards typed / metres sent, matched on every ranging), JSON export, nothing written, no HTML sinks | PASS 21 / FAIL 0 |
| `foldtest.js` | Fold layout (V1.6.0): outer screen unchanged; unfolded Devices → live log in the second pane, Capture → finder + byte-change table + GATT dump + log, Lane / Data → full width with ◧ Log, Log → full width in its tab; switch per tab remembered; capture results back in their exact place; folding mid-capture keeps the device connected and recording; desktop two panes; landscape phone single column; garbage stored choices → defaults; no HTML sinks | PASS 25 / FAIL 0 |
| `matchtest.js` | Profile matching (V1.6.1): the Calypso profile by name (`WDOT-…`) only. A device with the same ISSC FFF1/FFF2 layout and another name (Vector Paragon SCRF-S24) or no name → generic profile and ZERO writes with auto-initialise ticked. A real Calypso still auto-handshakes with its own `:DU`. Choosing Calypso by hand still sends the handshake. The Garmin service is named in the chooser with the wide net on and off | PASS 11 / FAIL 0 |
| `profiletest.js` | Device profiles (V1.7.0): Element Titan/Helix (the five confirmed rangings, yards column, junk frame), AEA BC1500 (split text lines, yards, JSON `#point#`, distance without angle, broken JSON), LabRadar LX. LabRadar: the frame builder matches the real app frames byte for byte; the simulated unit checks every CRC with an independently written CRC and accepts only the real key; the start sequence order; key accepted / rejected; armed event; the three real shot frames cut into 20-byte notifications match the CSV (V0, V@25 m, 25.30 gr); a bad-CRC frame is dropped; the poll stops on disconnect. Zero writes to rangefinders, zero to the LabRadar with auto-init off. No HTML sinks | PASS 30 / FAIL 0 |
| `maindatatest.js` | CORE-09 (V1.2.0): the real Lab page and the real Main calculator in two jsdom windows sharing one IndexedDB — no Main data → message and no database created; Main saves → identical counts and active session; Main's data unchanged and no upgrade blocked; chrono average vs profile MV; re-read on return; localStorage fallback; newer schema refused; unreadable data reported | PASS 13 / FAIL 0 |

```bash
cd tests
NODE_PATH=/tmp/jsdom/node_modules node probetest.js ../index.html
NODE_PATH=/tmp/jsdom/node_modules node capturetest.js ../index.html
NODE_PATH=/tmp/jsdom/node_modules node unlocktest.js ../index.html
NODE_PATH=/tmp/jsdom/node_modules node lanetest.js ../index.html
NODE_PATH=/tmp/jsdom/node_modules node rftest.js ../index.html
NODE_PATH=/tmp/jsdom/node_modules node foldtest.js ../index.html
NODE_PATH=/tmp/jsdom/node_modules node matchtest.js ../index.html
NODE_PATH=/tmp/jsdom/node_modules node profiletest.js ../index.html
# needs a checkout of SprukK/SEN-Balistic-Calculator next to this repo
NODE_PATH=/tmp/jsdom/node_modules node maindatatest.js ../index.html ../../sen-balistic-calculator/index.html
```

`maindatatest.js` must also be re-run whenever Main changes its storage names or snapshot shape (storage contract next to `IDB_NAME` in Main's `index.html`).

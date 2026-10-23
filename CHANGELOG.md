# SEN BLE Probe — changelog

`index.html` is always the current probe; each version is kept alongside it for rollback.

## V1.2.0 — 2026-10-23
- **Main app data (CORE-09).** New panel showing the SEN calculator's data on this phone, read over the shared `sprukk.github.io` origin: where it was found (IndexedDB, or Main's localStorage fallback), profile counts, and the active session (rifle, profile MV, projectile, BC for the session's drag model, weather). Refresh button; re-reads automatically when you return to the app.
- **Read-only by construction** (`SenMainData`): opens Main's `sen_main` database without a version and aborts if it doesn't exist (never creates it — that would break Main's first launch), read-only transactions only, closes the connection immediately (never blocks a Main upgrade), refuses snapshots with a schema newer than it knows, reports unreadable data instead of throwing.
- **Chrono vs profile MV:** every chronograph card shows the shot-string average against the active Main rifle's profile MV, in m/s and %.
- Storage contract with Main: Main owns `sen_main` / `sen_platform_*` / `sen-ballistics-*`; the Lab owns `sen_lab` / `sen_lab_*` / `sen-ble-probe-*`. Main V1.25.1 stops deleting this app's offline cache on its own releases.
- Tests now live in the repo: `tests/probetest.js` (the 25 V1.1.0 device checks, recovered) and new `tests/maindatatest.js` (13 checks against the real Main app). Verified: node --check; probetest ALL PASS (25); maindatatest 13/13; real Chromium with both apps on one origin reads Main's data.

## V1.1.1 — 2026-10-18
- Installable as its own app: added `manifest.json` (id `/sen-ble-probe-sprukk/`, scope `./`), probe icons with a BLE badge, and `sw.js` (network-first HTML, offline fallback, cache `sen-ble-probe-*`, separate from the calculator).
- Fixes Chrome reporting the probe as "already installed" (no manifest, so Chrome had no separate app identity on the shared sprukk.github.io origin).
- Verified: 25/25 DOM tests unchanged; headless Chromium shows manifest parsed with no errors, SW controlling, app id distinct from the calculator.

## V1.1.0 — 2026-10-18
- Multi-device: unlimited simultaneous devices, each with its own card, state, GATT op queue, keepalive and colour label.
- Device profiles (auto-detected, manually overridable):
  - Calypso Mini (wind): handshake, keepalive, step buttons, `:NA` rejection counter, `:GK` field 2 no longer assumed to be battery (2A19 is the battery source).
  - FX Pocket Pro (chrono, GATT): VRS service `5445883a-…5a2c`, notify `…5a2d` ASCII `fps,angle,bc,bc_type`.
  - FX True Ballistic (radar, GATT): service `00001623-88ec-…`, shot packets 0x0A/0x0B/0x0C, fitted 0/50/100 m velocities on 162B.
  - FX Pocket V2/D1 (chrono, broadcast): manufacturer data company 0x0059, via `watchAdvertisements()`.
  - Generic: raw hex/ASCII logging for unknown devices (rangefinder candidates).
- Shot string stats per chrono: avg, ES, SD (sample, n−1) in m/s, coloured against ES ≤ 5 / SD ≤ 1.5 m/s targets.
- Advertisement watcher, "Reconnect known devices" via `getDevices()`, browser-capability report.
- Timeline log with device filter; export always includes every device and a device table.
- FX protocol details from the community MIT client github.com/jtfiskar/flutter-fx-pocket-chrono — not confirmed by FX.
- Verified: node --check; 25/25 real-DOM jsdom click tests against simulated devices (2 Calypsos incl. one returning :NA, Pocket Pro, True Ballistic, V2 broadcast, generic) running concurrently.

## V1.0.0 — 2026-10-17
- Single-device Calypso probe: discovery, handshake, step-by-step replies, manual writes, log export.

# SEN BLE Probe — changelog

`index.html` is always the current probe; each version is kept alongside it for rollback.

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

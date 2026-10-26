# SEN BLE Probe — changelog

`index.html` is always the current probe; each version is kept alongside it for rollback.

## V1.4.0 — 2026-10-26
- **Wind lane (new Lane tab, CORE-17 preview).** An animated top-down lane: firing point at the bottom and the target at the top, with two wind stations beside it (default S1 on the left at 10 %, S2 on the right at 60 %). Each station has a live arrow and coloured wind streaks across its part of the lane. A bullet dot runs along the sideways path, which each station's wind bends. The impact shows at the target in mm, MOA and mrad, together with time of flight and each station's share (drift with the other station calm).
- **Settings:** lane length, MV, BC G7, and **Nearest station / Blend (linear)** between stations (an open CORE-17 question, now visible side by side).
- **Per station:** name, side, distance % and wind source. The source is either **Live** (any connected Calypso, using its rolling average; a reading older than 3 s drops to calm and is flagged LOST) or **Manual** (speed and direction sliders, plus optional simulated gusts).
- **Scale:** distances are to scale; sideways drift is exaggerated, and the factor is shown on the picture. Settings are remembered in `sen_lab_lane` (Lab namespace), clamped and whitelisted on load.
- **Physics, illustrative and not dope:** a point-mass RK4 on the bullet's velocity relative to the local wind. It uses Main's G7 table and V1.24.2 drag form, with fixed Ljubljana default air and no gravity or zero (top view only). For a uniform crosswind it reproduces the lag-time rule w·(t − R/V0) (35.42 mm both ways at 3 m/s, 100 m, Queen .25 at 280 m/s). The multi-station model itself is not §20A-verified; that belongs to CORE-17 in Main.
- The Calypso decoder now keeps each unit's last `:WU` (average, direction, time) for the lane. Nothing is written to any device.
- **Tests:** new `tests/lanetest.js` (23 checks: lag-rule match, symmetry, near-muzzle wind weighs more, head/tailwind, Calypso convention, nearest/blend mapping, equal stations = uniform wind (bit-identical), shares add up, live feed and stale drop, gusts, tab/animation start-stop, storage clamp, no HTML sinks). probetest ALL PASS (25), capturetest 20/20, maindatatest 13/13, unlocktest 13/13 (version-pinned check dropped). Checked in real Chromium at 412 px (outer screen) and 780 px (inner screen): no sideways scroll, no errors.

## V1.3.1 — 2026-10-26
- **Per-unit Calypso unlock.** The `:DU` sentence is a fixed per-device unlock token, not a clock-set (HCI snoop of Anemotracker, 2026-10-26): until a unit gets *its own* token it answers `:NA` to `:CC` and never streams `:WU`. New `CAL_UNLOCK` table keyed by device name: `WDOT-B1F9A6` → `:DU,1668647648,A7`, `WDOT-E2896A` → `:DU,1802347072,AF`. The handshake sends the unit's own token first; an unlisted unit gets every known token in turn until one is `:AK`'d (log says to add it to the table), and if none works the log says to capture it once via Anemotracker + HCI snoop. Step-1 button on each Calypso card shows that unit's token. Confirmed on hardware: both units streaming at once on the Honor Magic V5.
- **Discovery retry:** a service that returns no characteristics on the first try is asked once more after 300 ms (unit #1's battery service came back empty with two devices connecting at once, so 2A19 was never subscribed).
- Tests: new `tests/unlocktest.js` (14 checks: own token per unit, both live together, keepalive accepted after unlock, fallback, no-token hint, battery retry). `probetest.js` simulator now token-aware (its rejecting unit is an unlisted `WDOT-0A0A0A`); `capturetest.js` reads the version from the page. probetest ALL PASS (25), capturetest 20/20, maindatatest 13/13, unlocktest 14/14.

## V1.3.0 — 2026-10-25
- **Tabs:** Devices · Capture · Log · Data, as sections of one page (Web Bluetooth connections would drop on a page change, so devices stay connected whichever tab is showing). Bottom tab bar like the calculator; the last tab is remembered (`sen_lab_tab`, Lab namespace). A status strip under the title shows every device with its connection dot on every tab; tap a chip to jump to its card.
- **Capture sessions (LAB-03):** tick devices, pick a test — *FX angle test* (Level, Pitch up/down ~10°, Cant left/right ~10°, Shot), *Environment hunt* (indoors/outdoors/warm), or *Free* — and start. Records every notification (also those the log collapses), every advert and on-demand reads, with time-stamped markers (preset buttons or your own text). The summary table shows per characteristic: count, last value, and **which byte positions changed since the last marker** — the field that follows a pitch or cant stands out. Optional re-read of every readable characteristic every 2 s; *Read all now*; *GATT dump* (services, characteristics, properties, subscriptions). Export as JSON (devices, characteristics, markers, events) or chronological text. Nothing is ever written to a device.
- Tests: new `tests/capturetest.js` (20 checks, simulated FX with an extra notify stream and a readable sensor value); `probetest.js` (25) and `maindatatest.js` (13) unchanged and green. Real Chromium at phone width: no sideways scroll.

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

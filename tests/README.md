# SEN Lab (BLE Probe) tests

Run both before every release. Install the test dependencies **outside** the repo so no `node_modules` gets committed:

```bash
npm install jsdom fake-indexeddb --prefix /tmp/jsdom
```

| File | What it checks | Expected on V1.2.0 |
|---|---|---|
| `probetest.js` | Real-DOM (jsdom) click test against simulated devices running concurrently: two Calypsos (one streaming, one answering `:NA`), FX Pocket Pro, FX True Ballistic, FX Pocket V2 broadcast, generic device — handshake, shot parsing and stats, log filter, disconnect/reconnect, export. Recovered verbatim from the V1.1.0 build session (2026-10-18). | ALL PASS (25 checks) |
| `maindatatest.js` | CORE-09 (V1.2.0): the real Lab page and the real Main calculator in two jsdom windows sharing one IndexedDB — no Main data → message and no database created; Main saves → identical counts and active session; Main's data unchanged and no upgrade blocked; chrono average vs profile MV; re-read on return; localStorage fallback; newer schema refused; unreadable data reported | PASS 13 / FAIL 0 |

```bash
cd tests
NODE_PATH=/tmp/jsdom/node_modules node probetest.js ../index.html
# needs a checkout of SprukK/SEN-Balistic-Calculator next to this repo
NODE_PATH=/tmp/jsdom/node_modules node maindatatest.js ../index.html ../../sen-balistic-calculator/index.html
```

`maindatatest.js` must also be re-run whenever Main changes its storage names or snapshot shape (storage contract next to `IDB_NAME` in Main's `index.html`).

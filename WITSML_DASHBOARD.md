# WITSML dashboard (v5.12.12)

Files: `wdash_core.js` (pure parsing, image, sinusoid, SIM), `wdash.js` (UI), tests `wdash_unit_test.mjs`, `wdash_test.mjs`.

## Data sources
- **SIM** (default): generated in the page, tagged SIM. Never tagged LIVE.
- **WITSML 1.4.1.1 SOAP**: WMLS_GetFromStore for well / wellbore / log, header read, then incremental data polls every 10 s.
- **WITSML 2.0 / ETP 1.2**: not implemented (needs a WebSocket ETP client + server-side bridge for auth/CORS).
- LIVE tag only when: connected to a non-sim store, log index type matches the mode, data received < 2 min ago, rows present.

## Credentials
Held in a module variable only. Not written to localStorage, sessionStorage, cookies, IndexedDB or sync files. Password field cleared after Connect; Disconnect / close / reload clears them.

## CORS
Most WITSML stores do not send CORS headers, so a browser cannot call them directly. "Direct from browser" works only if the store allows the game origin.

## Proxy design (stub, nothing new deployed)
1. Existing hosted proxy (`tryfecta-witsml-proxy.netlify.app/witsml-proxy`): allow-list of one store. Auth via `X-Witsml-Authorization` header, passes through, logs nothing.
2. Local proxy: `node witsml_proxy.mjs` → `http://localhost:8796/soap` (any store, runs on the user's machine; credentials never leave it except to the store).
3. Per-customer proxy (future): same function as (1) with an allow-list per store URL, rate limit, no logging of bodies or auth headers, origin check for the game domain. Needs the store URL from the operator before adding to the allow-list. Can run on a free tier; not deployed.
4. ETP 2.0 (future): server-side WebSocket bridge (ETP needs Basic/Bearer on the WS upgrade, which browsers cannot set).

## Drilling Operations dashboard

Open **Monitor → Drilling operations** from the start screen. In the game, use **Tools → Replay and sequences → Drilling operations dashboard**. You can also open `?operations`.

- In training mode, the dashboard reads the current rig simulation. The tally uses the simulator's stand length and records connections during the session. Hold, Slide, Rotary, Take survey and Make connection call the existing simulator controls and interlocks.
- Select **WITSML** to open the game connection panel. Connect to a WITSML 1.4.1.1 store using the existing proxy or direct configuration. Select the well, wellbore and a **time-indexed drilling log**. Start the log or load the well, then reopen the dashboard. A fresh sample gets the **WITSML LIVE** or **WITSML SIM-TEST** badge. After two minutes without a current sample, the dashboard marks the feed stale. Controls stay disabled while the dashboard is observing the store.
- Use the connection panel's **Map to simulator** column to map nonstandard channel names. Dashboard-only options include flow out, ECD, active pit volume, gas, toolface, 0/1 alarm flags and anti-collision values. Units are taken from the log data or curve header. Unknown units and null values leave gaps.
- Connections and slide/rotary intervals are inferred from available drilling channels. An estimated end MD carries an approximation marker. A progress percentage requires an end MD. A bit position beyond the surveyed line is shown as an estimate only when it is within 30 m of the last station. Surveys and explicitly planned trajectories must belong to the selected wellbore. The rock cutaway is illustrative.
- Select **Load WITSML image** for depth-indexed azimuth bins from the same wellbore. The image track stays blank where bins are missing or beyond drilled depth. Replay excludes rows ahead of the replay cursor and leaves the untimestamped image log blank. This dashboard respects the existing replay availability setting.
- In training mode, the radar shows the simulator's simplified separation model. In WITSML mode, map upstream separation factor and centreline distance to show reported values. Map relative offset east and north to place the radar contact. Alarm rows reflect mapped flags. Missing channels display as unavailable.

Run `node operations_data_test.mjs`, `node conn_test.mjs` and `node wdash_unit_test.mjs` to check the data handling.

## Operations connection dock and scoped well import

Open **WITSML** from Operations. The connection panel docks beside the dashboard on a wide screen and expands above it on a narrow screen. **Close WITSML panel** collapses the connection controls. The selected log keeps polling. The **SOURCE** label shows the time from the latest time-indexed row in UTC. Check that the source time advances across two UTC minutes to validate a live feed.

In the standalone WITSML Dashboard, enter the store's exact well UID in **Known well UID** to read one well without listing the store. The reader requires exactly that well before it reads its wellbores and child objects. The reader stops on a guarded refusal or a conflicting object identity. Saved credentials apply only to the matching account and route. Browser credentials and machine caller authentication remain separate.

A matching credential substring in a reply still blocks the complete reply, including when the match is in a normal data field. The guarded machine proxy reports only a fixed location category when it can locate a password match in decoded XML. Ask the store owner to correct a credential echo or provide an authorised response that passes the same guard. Keep the raw response and credentials out of release evidence.

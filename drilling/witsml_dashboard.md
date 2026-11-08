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

## Operations connection dock and scoped well import

Open **WITSML** from Operations. The connection panel docks beside the dashboard on a wide screen and expands above it on a narrow screen. **Close WITSML panel** collapses the connection controls. The selected log keeps polling. The **SOURCE** label shows the time from the latest time-indexed row in UTC. Check that the source time advances across two UTC minutes to validate a live feed.

In the standalone WITSML Dashboard, enter the store's exact well UID in **Known well UID** to read one well without listing the store. The reader requires exactly that well before it reads its wellbores and child objects. The reader stops on a guarded refusal or a conflicting object identity. Saved credentials apply only to the matching account and route. Browser credentials and machine caller authentication remain separate.

A matching credential substring in a reply still blocks the complete reply, including when the match is in a normal data field. The guarded machine proxy reports only a fixed location category when it can locate a password match in decoded XML. Ask the store owner to correct a credential echo or provide an authorised response that passes the same guard. Keep the raw response and credentials out of release evidence.

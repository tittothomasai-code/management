# Drilling World v3 (game level) - SIMULATED
Run: cd /workspace/drill-sim/v3-game && python3 -m http.server 8000  -> open http://localhost:8000/
Files: index.html (HUD), main.js (scene, entities, input, loop), physics.js (ported v2 physics + connection sequence), vendor/ (three r160, offline), shoot.mjs (headless test + screenshots).
Controls: drag orbit, wheel zoom, WASD/QE fly, click machine = panel, double-click pump = exploded view.

## v4.0 — single wellbore fix, phone layout, hosted HTTPS WITSML proxy

**Rendering fix:** when measured depth jumps back (after a reset or a well switch), survey stations deeper than the bit are now dropped (`trimSurveys`). That stale deep leg is what made the "V" of two pipes. Now there is one wellbore and one drill string along a single path from surface.

**Mobile:** the page now has a `viewport` meta tag, and `mobile.js` turns on phone mode at ≤600 css px or on a touch screen. Every panel becomes a collapsible bottom sheet (a right-side drawer in landscape), opened from a dock of chips. Only one panel is open at a time, controls are ≥40 px, inputs use 16 px text (so iOS doesn't zoom), and the iPhone notch/home-bar safe areas are respected.

**Hosted proxy** (default): `https://kxwuaasuaskfyecjmuwa.supabase.co/functions/v1/witsml-proxy` (source: `supabase/functions/witsml-proxy/index.ts`).
- Stores **no** credentials. You type the username/password in the game. They stay in this tab's sessionStorage, are sent per request as `X-Witsml-Authorization: Basic …`, and are cleared on Disconnect or when the tab closes.
- Talks to exactly one upstream: `https://australia.adagasolutions.com/WMLS`. Read actions only (GetVersion, GetCap, GetFromStore); the function builds the SOAP envelope itself.
- CORS allows `https://tittothomasai-code.github.io` only. An upstream 401/403 is passed straight back and the game hard-stops (no retry).
- Nothing is logged. `verify_jwt` is off because browser users have no Supabase JWT; access is gated by the WITSML credentials, the origin, the host and the operation.
- **TLS verification is always on.** Supabase Edge (Deno) cannot skip certificate checks for a single host: there are no runtime flags, and `Deno.createHttpClient` has no ignore option. So while the Adaga certificate is expired, the proxy returns 502 "Upstream TLS certificate failed verification" and never sends credentials over an unverified link. The local `node witsml_proxy.mjs` remains an alternative.

## Equipment (v3 equip)
- "Add equipment" menu: add mud pumps (real sim hydraulics), tanks, shakers, desander, desilter, degasser, generator, BOP, choke manifold, accumulator, pipe rack, fuel/water tank, light tower, doghouse. Non-pump items are visual + simple state only.
- Click an item: panel with controls, Remove, and "Replace with 3D model" (GLB/GLTF/OBJ/FBX/STL file or URL). Drag to move. Layout and models are saved in this browser.

## v3.1 additions
- **Sequence panel**: Full (drill stand → connection → directional slide), Connection, Drill stand, Slide, Surface mud motor test, CSV replay. Play / Step / Pause / Stop, step mode, speed. Interlocks hold a step and show the reason.
- **Interlocks**: slips, roughneck (break/make, in/out), rotation and hoist blocked while the roughneck is in, pumps, drilling.
- **Signal sources**: each signal can be sim, csv or live (WebSocket stub). CSV columns: time_s,md_ft,spp_psi,flow_gpm,hookload_klbf,wob_klbf,td_rpm,quill_m,slips,event. `sample_sequence.csv` is SIMULATED sample data.
- **Movable sensors**: Add sensor, slide along the circuit (0–30% surface, 30–65% string, 65–100% annulus). The pressure reading follows the loss profile.
- **Pump drill-down**: Parts tree, liner/stroke sliders (flow per pump).
- **Equipment library** (`equipment.json`, add your own via Import types): geometry, nested parts, ports, sensors, physics `line_loss` (k·Q²), `bha` (dp, length, weight), `motor`, `none`. Place, connect, remove, export/import layout JSON.
- **Surface mud motor (test stand)**: library type `surface_mud_motor`. Connect it to the standpipe and pump flow drives it: RPM = Q·rev_per_gal, minus a load droop. ΔP = dp_off + brake torque / torque_per_psi, and it stalls above stall_torque. The rotor spins on screen. Readouts: RPM, ΔP, torque, inlet pressure. A brake slider sets load, and there is a "Surface mud motor test" sequence.
- **Environment/stress**: hook only (`S.envHook(S,dt)`).

## v3.2 additions
1. **Game visuals** – PBR + procedural environment map, textured terrain/pad, sky, trees, light towers; lattice derrick with X-bracing, racking board and ladder; substructure, handrails, doghouse; top drive on guide rails; crown sheaves, travelling block with N-line reeving, fast line and deadline anchor; drawworks drum with wire wrap; BOP stack (wellhead, mud cross with choke/kill valves, double ram, annular) and cellar; catwalk, pipe rack, HP manifold. Camera modes: **Orbit**, **Walk floor** (WASD/arrows, drag to look, Q/E), **Follow bit** (underground along the wellbore). All geometry procedural.
2. **Live feed** – click the "Feed" badge (or Connect…). WebSocket (push) or HTTP polling of JSON; editable URL, interval and field map; WITSML-style mnemonics (SPPA, MFIA/TFLO, HKLA, SWOB, RPMA, DMEA, BPOS) and `logData.mnemonicList/data`. Any signal set to source `live` uses it; when the feed errors, closes or goes stale (>5 s) values fall back to the SIMULATED physics.
   Test server (SIMULATED data from sample_sequence.csv, no dependencies): `node feed_server.mjs` → `ws://localhost:8795/ws` or `http://localhost:8795/latest` (`?fmt=witsml`). Browsers allow `ws://localhost` from the https page in Chrome; if blocked, open the game locally.
3. **Rig designer** – derrick rating, drawworks HP, lines and wire, top drive torque/RPM, BOP rating, any number of pumps (type, liner), drill pipe, motor, MWD, bit/nozzles, mud weight. Shows derived hookload, hoist speed, HHP, max flow/pressure, est. SPP, TFA and warnings. Applies to physics (hoist power, hookload interlock, RPM clamp, torque stall, pump SPM limits, pop-off, MWD loss, string weight). Save/load JSON.
4. **Mud pumps** – add any number from the designer or `Add equipment`; each has its own parts tree (3 or 5 modules), sensors, controls and manifold valve; flows sum into the standpipe; closing a running pump's valve trips it (dead-headed).
5. **Sequence editor** – sequences with steps: action, set, pumps, delay, wait (signal/op/value or condition, with timeout), call (nested sub-sequence with $params). Reorder, edit, duplicate, delete; tree view of progress with step/pause/play/stop; built-ins (Make connection = 7 sub-sequences, Drill stand + connect, Pump ramp test); export/import JSON; recursion detection.

## v3.3 – Trace recorder (strip chart)
Click **📈 Traces** (top-left). Pick a signal from the list and press **+ Add trace**, or click a pump, sensor, standpipe, top drive, surface motor or other equipment in 3D and press **📈 Add to trace** (or **All**) in its panel. **+ All pump traces** adds SPM, flow, discharge pressure and power for every pump.
- Signals: per pump SPM, flow, discharge pressure, hydraulic HP, tripped flag, per-module peak rod load and valve cycles; standpipe pressure, flow in/at bit, hookload, WOB, RPM, torque, depth, block height, ROP; every line sensor; fixed circuit points; surface mud motor RPM, ΔP and torque; any numeric value in any equipment panel.
- Stacked tracks with colour, units, auto-scaled min/max and the current value. The source tag shows SIM, CSV or LIVE per sample. Time window 30 s / 2 min / 10 min (sim time). Use ⏸ Pause, the slider or the mouse wheel to scroll back, and **Live ▶|** to return. Hover for a cursor readout of all tracks plus the nearest event. Sequence steps are dashed markers on the time axis. ✕ removes a track.
- **Export CSV**: time, each signal with units, the per-signal source column and the step events. The buffer holds 1 hour of sim time at 0.25 s.
- Test: `node trace_test.mjs [url] [outdir]` runs 4 pumps plus the surface motor through "Drill stand + connect" and takes shots 15–17.

## v3.4 – WITSML live data + trace any signal
**WITSML 1.4.1.1 (SOAP)**: press **🛰 WITSML** → enter server URL (default: Adaga `https://australia.adagasolutions.com/WMLS`), username and password → **Connect + list wells** → pick well / wellbore / log (time or depth) → check the auto-mapping (mnemonic → game signal; any can be changed or left as "trace only") → **▶ Start live**. The game polls `WMLS_GetFromStore` for rows after the last index (default every 2 s). Mapped curves drive SPP, flow, hookload, WOB, RPM, depth, block height, top drive torque and pumps 1–4 SPM, and are tagged **LIVE** in the signals panel and traces. If the data stops for 15 s, the rig falls back to the simulation.
- Read-only: only WMLS_GetVersion, WMLS_GetCap and WMLS_GetFromStore are used. Nothing is ever written to the store.
- **The proxy is required** (browsers can't call SOAP servers cross-origin): `node witsml_proxy.mjs` → `http://localhost:8796/soap`. It listens on 127.0.0.1 only. Credentials are sent per request, held only in the tab's memory, cleared on Disconnect, never saved or logged. Restrict targets with `WITSML_PROXY_ALLOW=https://australia.adagasolutions.com`. The proxy refuses servers with invalid or expired TLS certificates unless the host is listed in `WITSML_PROXY_INSECURE_HOSTS` (off by default; temporary use only).
- Chrome may block an https page from calling localhost. Allow "local network access" for the site when asked, or run the game locally.
- **SIMULATED test store**: "Use SIMULATED test store" → `http://localhost:8796/sim/witsml`. It has 1 well, 1 wellbore, a time log and a depth log, generated from sample_sequence.csv. It is clearly labelled SIMULATED, the feed badge shows "SIMULATED TEST" (amber), and traces show "SIM-TEST FEED". It is never shown as LIVE.
- WITSML 2.0 / ETP 1.2 (WebSocket + Avro binary) is **not implemented yet** (shown disabled).

**Trace any signal**: 📈 Traces → search box / **Signals ▾** tree. Every signal is listed:
- Rig and pump signals.
- Every surface and BHA equipment item, and every nested part from equipment.json (flow, pressure, ΔP, rpm, torque, inc/azi, weight), including user-added items.
- Sensors and circuit points.
- Bit and hole values.
- Sequence values.
- All physics state, and `S.env` (env hook).
- Every WITSML curve (mapped or not) and every raw live-feed field.

**ƒ Formula** traces: name + unit + expression with `[signal id]` (click a tree item to insert it), e.g. `[p1.flow]+[p2.flow]`, or `[spp]-base[spp]` (base = the value when added). Functions: abs min max sqrt pow exp log round. Formulas are saved in the browser.
Test: `node witsml_proxy.mjs & LNA_OFF=1 node witsml_test.mjs <url> <outdir>`.

## v3.5 — WITSML live hardening (2026-10-29)
- **Stale rules:** feed is LIVE only while healthy; marked STALE after 3 consecutive missed polls OR >2 min without a successful poll. Healthy shows `LIVE · last row hh:mm AEST`. Stale/disconnected falls back to physics sim and is labelled **SIMULATED** — sim data is never labelled LIVE.
- **Poll interval:** minimum 10 s (default 10 s). With 3 misses that is ~30 s to stale; 2-minute ceiling unchanged.
- **Auth guard:** any 401/403 from the proxy or upstream stops polling immediately and shows `Auth failed — polling stopped`. No auto-retry; reconnect is manual (Start). `witsml_proxy.mjs` also refuses all upstream calls after one upstream 401/403 until the proxy is restarted.
- **Defaults:** DR101L / WB01B02 / General Time-Based.
- **Mapping:** FLOW→flow (lpm→gpm), HKL/HOOKLOAD→hookload, ROP→ROP, BDE→bit depth, BHE→block height (m; not hole depth), SPP, WOB, RPM, TORQUE. Hole depth = DMEA if present, else max bit depth seen.
- **LIVE MODE toggle:** when on and the feed is healthy, WITSML values drive the 3D rig (bit/hole depth, hookload, block, top-drive RPM, pumps from SPP/flow, WOB, torque) instead of the physics sim.
- **Replay from data:** code present but **hidden** (`REPLAY_ENABLED=false` in ext4.js) after an upstream 401 during testing. Labelled `REPLAY · real data` when enabled, never LIVE.
- **Known data issue — hookload:** during the Adaga test HKL swung from **+17.8 to −18.6 klbf** within minutes. Mapping left unchanged; needs a check of the HKL zero/offset or tare on the source before relying on hookload.
- **Caveat:** the public GitHub Pages site cannot reach WITSML directly — it needs a local `witsml_proxy.mjs` on 127.0.0.1:8796. No credentials are stored in the site; the user enters them in the panel at runtime (not persisted).

## v3.6 — Units switch (2026-10-29)
- HUD button **Units: Metric / Imperial**; default **Metric**; choice saved in browser localStorage (`dw-units`).
- Metric: depth **m**, ROP **m/h**, flow **L/min**, pressure **kPa** (used everywhere, no bar), hookload/WOB **kN**, torque **kN·m**, power **kW**. Imperial: ft, ft/h, gpm, psi, klbf, ft·lbf, hp.
- Game physics stays imperial internally; `units.js` converts for display only: traces + values/axes, HUD clock line, entity panels (the floating 3D labels), pump/sensor trees, rig-designer results/warnings, CSV export headers and values. Switching rescales existing trace history.
- WITSML: each channel is converted from its own `uom` in the log header (e.g. lpm, m3/min, bar, kPa, MPa, kN, klbs, t, m, m/hr, N.m, kN.m, ftlb) to the game's internal units via one conversion table; unknown uoms pass through unchanged.
- Not converted (by design / caveat): rig-designer **input** fields stay imperial (results are converted); CSV **import** column names (spp_psi, flow_gpm, hookload_klbf, md_ft…) stay imperial; raw `wml:` channel traces display in the selected system; user formula traces keep the unit you typed.
- **Open question — depth datum:** time-log BDE ≈ 8768 ft (2672.5 m) vs the depth log ≈ 2656.9 m (~15.6 m apart). Check each log's uom and depth datum (RKB vs MSL, or rig floor vs ground) once the Adaga account is confirmed.

## v3.7 — metric everywhere
- Rig designer inputs show/accept the selected unit system (converted to internal imperial); designer re-renders on unit switch; derived capacities (power, hoist speed, BOP) converted.
- Event log text converted to selected units.
- Formula traces have a Quantity picker (Pressure/Flow/Force/Depth/ROP/Torque/Power/Mud density) and rescale on unit switch (linear formulas only).
- CSV import accepts either system by header unit: `spp_psi|spp_kpa|spp_bar`, `flow_gpm|flow_lpm`, `depth_ft|depth_m` (also `md_*`), `hookload_klbf|hookload_kn`, `torque_ftlbf|torque_knm`, `wob_*`, `rop_*`; also `name [unit]` / `name (unit)`. Unitless headers assume the currently selected system (logged); unknown units are ignored (logged).
- Signal sources panel shows (Metric/Imperial) and per-signal units.
- Caveats: bit/liner sizes stay in inches; pump model names (e.g. "1600 HP") unchanged; torque/ROP CSV columns are converted but not yet driven into physics; nonlinear formulas are not unit-aware.

## v3.8 — subsurface layers + survey
New files: `geo.js` (pure maths/parsers, node-testable) and `ext5.js` (UI/3D). HUD buttons **Subsurface** and **Survey**; a "Formation @ bit" readout sits above the clock.
- **Layers**: name, top/base MD & TVD, colour, UCS, porosity, pore & frac pressure (EMW). Add/edit/delete in the panel, CSV import (`name,top_m,base_m,top_tvd_m,base_tvd_m,lith,ucs_mpa,porosity,pp_sg,fp_sg`; unit suffixes `_m/_ft`, `_mpa/_psi/_kpa`, `_sg/_ppg/_kgm3`; unitless = selected system), and WITSML 1.4.1.1 `formationMarker` XML (mdPrognosed/tvdPrognosed/mdTopSample, thicknessBed, lithostratigraphic; base = next top). Drawn as translucent 3D strata in Underground view.
- The default layer set is a **SIMULATED example — not real formation data** (every name carries "(SIMULATED)").
- **Physics**: through `S.envHook`, the formation at the bit scales ROP (√(8000 psi/UCS)·porosity term, clamped 0.25–2.5) and top-drive torque (0.7–1.5). This is a SIMULATED rock model. `S.env` and `S.formation` are traceable, and entering a new formation is logged.
- **Survey**: WITSML `trajectory` XML (md/incl/azi with uom m/ft, dega/rad), CSV (`md_m|md_ft|md, inc, azi`), or manual entry. Minimum curvature gives TVD, N/S, E/W, DLS (°/30 m metric, °/100 ft imperial) and VS (closure azimuth). There is a table panel and traces for Survey Inc/Azi/DLS/TVD. The imported path is drawn in cyan (the simulator's own path in yellow). The bit/BHA follows the imported path, and rings plus labels mark each formation-top crossing.
- **Badges**: example, manual, CSV and WITSML-file data are always **SIM**. LIVE is only possible through `GEO.ingestTrajectory(xml,{live:true})`, which is not yet wired to the live poller.
- **Tests**: `geo_test.mjs` checks min curvature against the exact circular-arc solution (3°/100 ft build: TVD = departure = R = 1909.859 ft, DLS 3) and a 3D arc against numerical integration, plus the parsers and CSV units. `geo_ui_test.mjs` is the headless UI test. All WITSML samples are hand-made; no server was contacted.
- **Caveats**: the drill string/bore tube still follows the simulator path (only the BHA moves to the imported path). Layer properties don't yet affect pressures/kicks. Strata are flat (no dip).

## v3.9 — Live survey feed + per-well replica (offline-tested only)
- **Survey feed**: WITSML `trajectory` polling (default/min 60 s, separate from the 10 s log poll), incremental via `mdMn`, stations deduped by uid / ΔMD. `formationMarker` polled every 5th cycle if the server supports it.
- **401 guard**: any 401 in the game or the proxy stops every poll (logs + survey). No automatic retry. The proxy only allows GetFromStore/GetVersion/GetCap.
- **Path following**: the drill string, bore and bit follow the minimum-curvature survey path. Priority: live stations, then imported, then manual. Beyond the last station a straight tangent is drawn as a magenta dashed line labelled `PROJECTED · SIM`.
- **Per-well replica**: changing the well or wellbore in Live mode resets all state. It then rebuilds from that well's trajectory, formation markers, wbGeometry casing, rig/location and log channels. Anything missing is tagged SIM.
- **Data Coverage panel**: shows each item as LIVE / SIM-TEST / SIM / missing.
- **Mock**: `mock_upstream.mjs` serves 2 fictional wells on 127.0.0.1 and is always labelled **SIM-TEST**, never LIVE.
- Caveats: not tested against any real WITSML server yet. `mdMn` is treated as inclusive (the dedupe handles overlap). After a 401, polling only restarts if the user presses Start again.

## v4.1 — never fail silently (WITSML)
- Every WITSML action (Start live, Load full well replica, Start survey feed, well switch) shows a red banner when not connected: "Not connected — enter Adaga login in WITSML panel and press Connect", opens the WITSML panel and focuses the username field. No proxy call is made.
- Connect with an empty login asks for username/password. Connect, survey feed and load-well show clear messages for errors, network failures, and empty results.
- On phones, the username/password inputs are 46 px touch targets. Test: `node v41_conn_test.mjs`.
- Cert note: a scoped TLS skip (node:https / node:tls with rejectUnauthorized:false for one host) does NOT work on Supabase Edge. The runtime still enforces verification. witsml-proxy stays at v1 with verification on. The Adaga cert must be renewed, or a different host is needed.

## v4.2 — Netlify proxy (default)
- Default proxy: `https://tryfecta-witsml-proxy.netlify.app/witsml-proxy`. This is a Netlify Function on the new site `tryfecta-witsml-proxy` in the Tryfecta capital team. Source: `netlify-proxy/`.
- Upstream uses Node `https.request`. A per-request `https.Agent({rejectUnauthorized:false})` is used ONLY when the hostname === `australia.adagasolutions.com`. Every other host is verified.
- Same rules as before: only the Adaga /WMLS URL, read ops only, SOAP built server-side, CORS for tittothomasai-code.github.io only, credentials only in X-Witsml-Authorization and never stored, 401/403 passed back, no logging. Rate limit: 60 requests/min per IP (best effort).
- Supabase `witsml-proxy` is still available as a fallback in the Proxy field's dropdown. Its cert is always verified, so it fails while the Adaga cert is expired.
- Live log poll default is 15 s (minimum 10 s).

## v4.3 — Geology layers on iPhone + connection / joint detection (estimated)
- **Subsurface layers**: one card per layer, 16 px / 40 px+ fields, colour picker, big **+ Add layer** and **+ Add layer at bit depth** (splits the layer containing the bit), delete with Undo. Depths follow Metric/Imperial.
- **Connections panel** (`ext6.js`, logic in `conn.js`, tests in `conn_test.mjs`, `v43_test.mjs`): detects off bottom → pumps off → RPM 0 → hookload to block weight (slips) → block travels up → pumps/rotation resume → drilling resumes, from BDE/DMEA/BHE/HKL/RPM/FLOW/SPP/WOB (+ slips channel if present). Per connection: slips-in/out, slips-to-slips duration, pumps-off time, depth, joint length (depth differences; median → single/double/stand). Tool-joint depth list, 3D rings, chart markers, KPI line, CSV export, configurable thresholds. Sources: live WITSML history (accumulates since Connect), Replay, CSV import, SIM-TEST synthetic. **All results are estimates from data.**

## v4.4 — Bit-depth tracking + new-pipe animation
- New **Bit depth** panel (ext7.js; phone bottom sheet "Bit depth") and a small always-on HUD at the top: source badge (LIVE / SIMULATED / REPLAY / SIM-TEST / SIM), bit depth, hole depth, **off-bottom distance**, formation at the bit.
- The 3D string and bit follow bit depth from data: **Live** WITSML (glides from the last value to each new poll over the measured poll interval, ≥10 s), **Replay** (interpolated between log rows at the replay time) and the **SIM-TEST timeline** (synthetic, clearly labelled). Hole depth is tracked separately; a white ring marks hole bottom when the bit is off bottom, a cyan marker is the bit.
- Geology strip: the layers around the bit with the bit arrow and hole-bottom line.
- **Camera follows bit** option.
- **New-pipe animation** at every connection: lift a single from the catwalk (a stand from the racking board when the joint is > 20 m) → stab → make up (spin, tool-joint ring flashes) → slips out → lower; the orange tool-joint ring rides down with the string. Uses the detected joint length (conn.js median). Replay/SIM-TEST: tied to the timeline (slips in → slips out + 30 s), so scrubbing shows the right phase. Live: plays for 20 s when slips are set with the bit off bottom (or the Connections panel finds a new connection). Toggle "New-pipe animation" turns it off.
- Test: `node v44_test.mjs` (iPhone 390×844, offline SIM-TEST only, no Adaga calls). Screenshots shots_live/80–86_v44_*.
- Caveats: Live path tested only by code review + SIM-TEST; live trigger needs a slips/hookload signal. Hole depth falls back to deepest bit depth seen when no hole-depth curve.

## v4.5 — Slips inferred from bit depth (no slips / hookload curve)
- New `slips.js` (pure, unit-tested). When the data has **no slips curve**, the slips state is **Inferred from bit depth**: in slips = bit depth flat within ±tolerance (default 0.2 m) for a minimum dwell (30 s) with the bit off bottom (≥0.3 m). Confidence (0–100 %) rises with: bit near bottom (≤6 m), pumps off, rotation off, block/hook height travelling while the bit stays put (≥3 m), drilling resuming deeper afterwards, and the next connection being ~one joint/stand deeper (8–31 m). Bit moving away ≥5 m with no new hole = **tripping** (shown, never counted as a connection). Pumps+rotation on while flat = circulating/reaming (rejected). **Hookload is not used** (Titto's trick comes later); slips curve still preferred when present.
- conn.js uses it as the fallback slips source (works even with only bit depth, or bit + hole depth); each connection carries a confidence; CSV adds `slips_confidence,slips_source`.
- ext7: Bit-depth panel and top bar show **SLIPS IN ~NN% · Inferred from bit depth** (Live = provisional, no look-ahead); slips band on the timeline (orange = connection, purple = trip, grey = below min confidence); live new-pipe animation triggers on inferred slips (not on trips). "Advanced: slips inference" holds the thresholds (metric default, ft in imperial). SIM-TEST checkbox runs the timeline with slips + hookload removed.
- Tests: `node v45_unit.mjs` (accuracy table), `node v45_test.mjs` (iPhone 390×844, offline). Screenshots shots_live/90_v45_*.
- Caveats: tested on synthetic data only; slips-out timing is ±20 s with pumps, ±60 s with bit depth only; a real rig that reciprocates the string or has a noisy/laggy BDE may need a larger tolerance.

## v4.6 — Live well profile fix
- Root cause: in LIVE/Replay with no survey stations, the 3D well fell back to the SIM physics trajectory (KOP 1500 ft, 3°/100 ft build to 35°, az 45) stretched to the live MD → invented curve. The top bar also always said "SIM time".
- Now: LIVE/Replay without real surveys draws a vertical well and shows "No survey — trajectory assumed vertical"; the SIM plan line is hidden; the clock shows "LIVE data | MD … | well path: …". SIM-TEST stations are never used as a LIVE trajectory.
- Trajectory parse: if incl/azi have no uom and every value fits the radian range, they are read as radians (`radGuess`). Explicit `uom="rad"` was already converted.
- Test: `node v46_test.mjs` (screens shots_live/95_v46_*.png).

## v4.7 — trajectory discovery + survey guardrails
- "▶ Find surveys / start feed" lists every wellbore of the well and every trajectory (id-only), fetches stations, prefers the active log's wellbore (uid match, not names), chooser when >1.
- Parser handles prefixed namespaces, CDATA, double-escaped XMLout, unit-less angles (radian guess).
- Guardrails: parent match (trajectory must be in the active log's uidWell/uidWellbore; other wellbores never auto-used, manual pick shows "Wellbore mismatch"); HUD "Well / Wellbore / Trajectory"; currency ("Survey stale" > 100 m behind hole or > 24 h older than log; "Survey deeper than hole" > 100 m); re-poll every 60–300 s, stops on 401; sanity (MD monotonic, incl 0–180, azi 0–360, dogleg ≤ 15°/30 m) drops + counts bad stations.
- "Survey debug" (WITSML panel): each query step, counts, first 300 chars of raw XMLout (credentials redacted), source, freshness, sanity badges.
- Tests: v47_test.mjs (24 checks, SIM-TEST mock). Screenshots shots_live/96_v47_*.png.

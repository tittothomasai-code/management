# READY: Rig Builder (feat/rig-builder, base 58c322a) — NOT DEPLOYED
Waiting for Showroom C (v5.11.7) live. Then SE1: rebase onto live, run regressions one at a time (showroom, showroomb, showroomc, night, night_real, phone, desk, dock, start, ddrun, ddtracks), standard export (no private_edm, no 126/127, no source/), deploy, record ID/live checks/state.
Files: rigbuilder_core.js (pure, rb1), rigbuilder_store.js (localStorage dw_custom_rigs_v1, setAdapter for future Supabase), rigbuilder.js (UI, GX.rigBuilder), rigbuilder_test.mjs.
Hooks (grep "rig-builder hook"): index.html script + ?demo=rigbuilder; input.js pad guard; home.js anyOpen; start.js key/pad guard; showroomb.js open() appends custom rigs.
Features: 150-part catalogue (A/B/C) in 11 slots, live BOM, SIM specs (hook load, depth, power, BOP), save under unique trimmed name, load/rename/duplicate/delete(confirm)/export/import JSON, view in Showroom B. Controller/keys/touch, desk + 390x844.
Limit: custom rigs listed in Showroom B only (A is fixed, C is single-rig hero).
Test: rigbuilder_test.mjs 59/0 (desk+phone). Shots: shots_live/200_rb_{desk,phone}_{builder,saved,showroom_custom}.png, 200_rb_phone_specs.png.

## rb2 — live 3D assembly (2026-10-31)
Status: READY, NOT DEPLOYED (waits for Showroom C live). SE1 must bump index.html `rigbuilder.js?v=rb1` → `?v=rb2` at merge (cache-tag rule; not edited here).
- rigbuilder3d.js: real part meshes cut from Showroom B pass-1 / C pass-2 GLBs (manifest LODs) and Blender A rigs (by node name; A has no userData.part). Orbit/zoom, hover/select highlight, dark stage, render on demand, LOD L on phone (`?rblod=` override).
- rigbuilder_core.js: ANCHORS table + layout(); pumps/generators instanced in rows by count; nodeSet() = save/reload identity.
- Showroom B shows the assembled custom rig (rig-builder hook in showroomb.js loadRig).
- mobile.js rig-builder hook: #showroomB / #rigBuilder skipped by the bottom-sheet layer (was shrinking Showroom B to an 18 px sheet on phone).
- Phone: slot row no longer clipped (scroll row, 52 px buttons).
- Tests: rigbuilder_test desk 36/0, phone 39/0 (meshes per slot, anchors, nodeSet after save/reload, rows = qty, phone budget LOD L, fps≥1, ≤250 calls, ≤150k tris; box load ~50 so FPS is a floor only).

### Missing models (ask Titto)
1. Single-unit genset GLB — B land_1500/land_3000 "generators" is one merged bank; bank is repeated per count.
2. Standalone mud tank — B "mud_system" bundles pumps+tanks; tanks slot has no own B mesh.
3. A pack: substructure/drill floor (only "site" exists); generators and mudpumps are banks; add userData.part tags to A files.
4. Single frac pump truck — B frac pump_trucks repeated as a bank.
5. Standalone offshore derrick — offshore "drilling_package" bundles mast with other kit.

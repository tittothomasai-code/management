# READY: Rig Builder (feat/rig-builder, base 58c322a) — NOT DEPLOYED
Waiting for Showroom C (v5.11.7) live. Then SE1: rebase onto live, run regressions one at a time (showroom, showroomb, showroomc, night, night_real, phone, desk, dock, start, ddrun, ddtracks), standard export (no private_edm, no 126/127, no source/), deploy, record ID/live checks/state.
Files: rigbuilder_core.js (pure, rb1), rigbuilder_store.js (localStorage dw_custom_rigs_v1, setAdapter for future Supabase), rigbuilder.js (UI, GX.rigBuilder), rigbuilder_test.mjs.
Hooks (grep "rig-builder hook"): index.html script + ?demo=rigbuilder; input.js pad guard; home.js anyOpen; start.js key/pad guard; showroomb.js open() appends custom rigs.
Features: 150-part catalogue (A/B/C) in 11 slots, live BOM, SIM specs (hook load, depth, power, BOP), save under unique trimmed name, load/rename/duplicate/delete(confirm)/export/import JSON, view in Showroom B. Controller/keys/touch, desk + 390x844.
Limit: custom rigs listed in Showroom B only (A is fixed, C is single-rig hero).
Test: rigbuilder_test.mjs 59/0 (desk+phone). Shots: shots_live/200_rb_{desk,phone}_{builder,saved,showroom_custom}.png, 200_rb_phone_specs.png.

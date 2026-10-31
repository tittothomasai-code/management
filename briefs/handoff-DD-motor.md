# Handoff: DD Training mud motor management — READY
Helper DD-motor · worktree /workspace/drill-sim/wt-ddmotor · branch feat/dd-motor · base gh-pages d46cb5a (v5.11.0). Not pushed, not merged.

## Scope done (all SIM-tagged, never LIVE)
- Motor spec sheet: 3 generic motors (4-3/4, 6-3/4, 8 in), lobes, stages, rev/gal, flow range, max/stall diff P, torque per bar, bend geometry, stator rating.
- Bend + toolface: bend select (0–2.12°), yield by three-point geometry, rotate-with-bend RPM limit, MTF/GTF switch at 5° inc, reactive torque TF shift when sliding.
- Diff pressure + stall: dP from WOB (T = μ·WOB·D/3, torque ∝ dP), SPP = off-bottom + dP, stall at 1.35 × max (RPM 0, SPP spike), recovery steps, pick-up clears it. dP-vs-WOB chart with 80 % and stall lines.
- Motor RPM per flow (no-load and loaded), bit RPM = motor + surface when rotating, flow range warning.
- Wear (done early): stator/bearing equivalent hours by load, temperature, stalls; pull-the-motor advice. Slide-sheet helper `slideFor`.

## Files
New: ddmotor_core.js, ddmotor.js, ddmotor_test.mjs, docs/ddmotor.md (methods + sources), shots_live/164_ddmotor_{phone,desk}_{1_panel,2_stall}.png.
Shared-file hook (1 line): ext3.js init chain imports `./ddmotor.js?v=1` before ext14. No index.html / stamp / cache-tag edits.

## Cabin hook (for wt-ddcab / feat/dd-cabin)
`window.GX.ddcab.motor` (= `window.DDMOTOR`): `mount(el)` renders the panel inline in the cabin Motor tab; `step({flow,wob,rpm,rotating,tvd,inc,tf,bend,hours})` drives it from the cabin drill loop and returns state + health; `state`, `health`, `C` (engine). The cabin still has its own simple motor in ddcab_core.js; integrator can switch its Motor tab to `GX.ddcab.motor.mount()` when merging.

## Tests (port 8862, run one at a time, box load 60–85)
ddmotor 35/0 · start 38/0 · phone 82/0 · desk 25/0 · dock 23/0 · monitor 34/0 · gamepad 45/0 · edm 25/0.
Not run yet (deadline): edmsave (stopped by me mid-run, not a failure), edmstats, wml, wmlinv, anim. Run these before merge.

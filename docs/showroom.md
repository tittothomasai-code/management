# Rig showroom (SIM)

Open: home tile "Rig showroom", HUD button "🏁 Showroom", or `?demo=showroom`.

- One rig on a turntable. Swipe (phone), ← / → or A / D, controller LB / RB to change rig. Enter / A = use this rig. Esc / B = back / close.
- 9 rig classes: land single, land triple, heli-portable, workover, CTU, jack-up, semi-sub, drillship, frac spread.
- Spec card values (hookload, drawworks power, mast height, pumps, BOP rating) are generic class values from public rig-class ranges (IADC rig classes, API 4F / 7K / 16A / 16D ratings). They are SIM values, not a real rig.
- Asset table (right drawer; bottom sheet on a narrow phone): A rig > B assets > C components > BOM lines.
  - B and C come from feat/bom `RIG` (`GX.bom.RIG`, `asset(id)`). Downhole models (`group:'downhole'`) are not shown on the rig.
  - Mesh tag → RIG id: mudpump→mudpumps, pipe→pipehandling, mudsys→mudtanks, gen→generators, accum→accumulator, others same. `block` has no RIG asset; it uses the ext12 catalogue.
  - If bom_data.js is missing, C rows fall back to the ext12 catalogue parts.
  - Lines with `part:null` have no workshop 3D model: no exploded-view button.
- The rig models are one mesh level. A C selection highlights and zooms to its B asset.
- "Use this rig" sets the game design (GX.setDesign) and saves `dw_showroom_rig`. Frac spread loads 4 pumps in the scene (card shows the fleet of 16).
- Day / night: button "☾ Night" in the showroom. Uses feat/night `GX.night.set(on, showroomScene, rigRoot, {ren, quality, instant})` (+ `useThree(THREE)`), re-applied instantly on rig change, `GX.night.dispose(scene)` on close. Starts in the main scene's night state. Guarded: no-op if night.js is missing. Main-scene night state is not changed.

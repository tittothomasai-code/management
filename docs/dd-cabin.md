# DD Training cabin (helper DD-cabin)

Open: home page tile **DD Training**, the **DD Training** button in the menu group (next to Well control), `?demo=ddcab` (optional `&scen=build|tangent|land|collide`), or `window.DDCAB.open()`.
Files: `ddcab_core.js` (pure engine, Node-testable), `ddcab.js` (cabin UI), `dd_cabin_test.mjs`. All values are SIM. Nothing is labelled LIVE. No external requests.

## Screens
- Survey table (MD, Inc, Azi, TVD, DLS °/30 m, distance to plan) and projection to bit (last two surveys extrapolated at their DLS/TF over the MWD offset).
- Travelling cylinder (normal plane, high-side referenced; north referenced below 5° Inc) with separation factor = centre distance / SIM error sum (0.0075 × MD sum + 1 m, ISCWSA-style growth).
- Toolface dial (gravity TF above 5° Inc, magnetic below), last slide toolfaces and recommended TF.
- Rig data: ROP, WOB, diff pressure, SPP, torque, flow, motor/surface/bit RPM, bit temperature, stator hours.
- Vertical section plan vs actual, with the target zone (land) and the offset well (collide). Gamma strip from `strat.gammaAt` on the strat model (fallback SIM curve).
- Slide/rotate calculator: required DLS from projection-to-bit to the plan 30 m ahead, motor yield, slide length = dogleg / yield × 30, toolface from the dogleg plane.

## Steering instructions (scripted driller, ASD-STE100 wording)
`Slide 10 m at TF 30` (`30L` = 330°), `Rotate 30 m`, `Set WOB 8`, `Set flow 1800`, `Set RPM 40`, `Take a survey`, `Pick up off bottom`. The driller reads back, executes, and reports. Slides get SIM reactive-torque scatter (±8° TF) and ±10 % yield scatter. Rotating gives a small SIM drop/walk.
Scenarios: build to target, hold tangent (formation walk), land in target zone (zone from `strat.targetFn` shape, rebased onto the plan landing point; SIM band fallback), avoid offset well (plan path crosses SF 1.5).
Score: average distance from plan, DLS over scenario limit, time over allowance (8 m/h), in-zone % (land), SF < 1.5 penalty (collide).

## Mud motor (SIM generic 6-3/4 in, 7:8 lobe, 4.0 stage, 1.5° bend)
- Motor RPM = flow × rev/volume (0.28 rev/gal = 0.074 rev/L), with RPM droop under load. Bit RPM = motor RPM + surface RPM when rotating.
- Diff pressure rises with WOB (scaled by formation torque response from strat.js). Torque ∝ diff pressure up to stall torque. SPP = off-bottom SPP + diff pressure.
- Stall when diff pressure ≥ max: SPP spike, motor RPM and ROP go to zero; driller stops and refuses to drill until pick-up. Recovery steps shown (pick up, let SPP settle, check flow, tag bottom with half WOB, keep ΔP < 80 % max).
- Motor yield from three-point bend geometry: DLS ≈ 2 × bend / (bit-to-bend + bend-to-stabiliser) per 30 m.
- Rotate-with-bend warning above 1.83° bend or 60 RPM. Flow range warning. Stator hours weighted by load (1 + ΔP/ΔPmax); temperature = 20 °C + 3 °C/100 m TVD + motor heating.

## Sources
- Minimum curvature: Taylor & Mason (1972) SPE 3362; dogleg formula per API Bul. D20 / ISCWSA survey terminology.
- Toolface and travelling cylinder conventions: ISCWSA Collision Avoidance work group; Inglis, *Directional Drilling* (1987).
- PDM relations (RPM ∝ flow, torque ∝ ΔP, stall, recommended ΔP operating range, rotate-with-bend limits): published motor handbooks (NOV PowerPLUS / Halliburton SperryDrill / Baker Hughes Navi-Drill). Values here are generic and SIM.
- Slide-sheet practice (slide/rotate ratio from required DLS and motor yield): standard DD slide-sheet method.

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

## Plug-in hooks (scope split)
The cabin owns only the UI and the data screens. Two other helpers plug in:

- **Steering instructions + driller script — feat/dd-driller.** `GX.ddcab.onInstruction = (text, api) => ({say:[lines]} | void)`. The input box and the calculator button send text to it. `api = {sess, core, drill(len,{rotate,tf}), survey(), log(line), render()}`. If no hook is set, the cabin shows "the driller module is not loaded" and does not drill. `ddcab_core.command/parse/ste` stay in the code as a reference only and are not connected.
- **Mud motor management — feat/dd-motor.** `GX.ddcab.motor = {spec, state(motor,opts), panel(sess)->html, bind(slotEl,sess,render)}`. It renders into `#ddMotorSlot`. You can also pass `newSession(id,{motorFn})` to supply stall physics. By default the motor is a plain SIM motor and never stalls.

## Sources
- Minimum curvature: Taylor & Mason (1972) SPE 3362; dogleg formula per API Bul. D20 / ISCWSA survey terminology.
- Toolface and travelling cylinder conventions: ISCWSA Collision Avoidance work group; Inglis, *Directional Drilling* (1987).
- PDM relations (RPM ∝ flow, torque ∝ ΔP, stall, recommended ΔP operating range, rotate-with-bend limits): published motor handbooks (NOV PowerPLUS / Halliburton SperryDrill / Baker Hughes Navi-Drill). Values here are generic and SIM.
- Slide-sheet practice (slide/rotate ratio from required DLS and motor yield): standard DD slide-sheet method.

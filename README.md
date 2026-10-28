# Drilling World v3 (game level) - SIMULATED
Run: cd /workspace/drill-sim/v3-game && python3 -m http.server 8000  -> open http://localhost:8000/
Files: index.html (HUD), main.js (scene, entities, input, loop), physics.js (ported v2 physics + connection sequence), vendor/ (three r160, offline), shoot.mjs (headless test + screenshots).
Controls: drag orbit, wheel zoom, WASD/QE fly, click machine = panel, double-click pump = exploded view.

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

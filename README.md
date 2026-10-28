# Drilling World v3 (game level) - SIMULATED
Run: cd /workspace/drill-sim/v3-game && python3 -m http.server 8000  -> open http://localhost:8000/
Files: index.html (HUD), main.js (scene, entities, input, loop), physics.js (ported v2 physics + connection sequence), vendor/ (three r160, offline), shoot.mjs (headless test + screenshots).
Controls: drag orbit, wheel zoom, WASD/QE fly, click machine = panel, double-click pump = exploded view.

## Equipment (v3 equip)
- "Add equipment" menu: add mud pumps (real sim hydraulics), tanks, shakers, desander, desilter, degasser, generator, BOP, choke manifold, accumulator, pipe rack, fuel/water tank, light tower, doghouse. Non-pump items are visual + simple state only.
- Click an item: panel with controls, Remove, and "Replace with 3D model" (GLB/GLTF/OBJ/FBX/STL file or URL). Drag to move. Layout and models are saved in this browser.

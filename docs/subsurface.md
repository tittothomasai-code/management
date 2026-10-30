# Live subsurface view (subsurface.js)
- Own overlay `<section id="subsurf">`: separate WebGLRenderer + scene + OrbitControls, so the main rig scene is not changed. It is a SECTION (not DIV) so mobile.js does not turn it into a bottom sheet.
- Open: Tools button "Subsurface" (#subBtn), key V (Esc closes), gamepad Y (button 3; 8/9 are legend in input.js). API `GX.subsurface.{open,close,toggle,state,layers,lithAtBit}` (re-attached every 0.5 s because GX is rebuilt after load).
- Frame: metres, x=E, y=-TVD, z=-N. Actual path from GEO.calc (else wellPts()/0.03*0.3048), orange tube. Plan from G.PH.planPath(), green dashed.
- Layers: helper D `strat.js` model() via dynamic import if present; else 7 SIM layers, tagged SIM. Rock at bit from strat atBit()/lithAt or SIM layers.
- Casing/cement from GX.casing.design() (shoe/top MD in m) along actual path; cement shoe→TOC (tocMD or shoe-300 m).
- Offset/EDM wells from GX.edm.ST.wells (max 200), grey lines.
- HUD: MD, TVD (m), Inc, Azi, ROP (m/h), WOB (t), rock at bit, SIM tag. Never LIVE.
- Rebuild 1 s; camera follows bit (Follow on/off; Fit well). Quality Low/Med/High → pixel ratio 1/1.5/2, tube segs 6/8/12, path points 120/300/600; listens to 'dw-quality'.
- Test: `node subsurface_test.mjs http://localhost:8813` (26 checks, desk+phone).

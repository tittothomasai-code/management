# Well planning + drilling physics (helper G)

Files: `wpg_core.js` (pure maths, node importable), `wpg.js` (UI tabs in the 🧭 Well planning panel), `wpg_test.mjs`.
Hook: one line in `wplan.js` `init()` → `import('./wpg.js?v=G1').then(reg)`.
All outputs are planning aids and are tagged **SIM**. Nothing is written to Supabase, WITSML or Adaga.

## Tabs
| Tab | Content | Method / source |
|---|---|---|
| Design | Build-hold (J), S-shape, horizontal (build-hold-build landing), multilateral (laterals from main bore); targets with horizontal radius + TVD tolerance; dogleg limit; editable section list (hold / curve / target) | Minimum curvature (SPE-84246 / Sawaryn & Thorogood 2005); curve-hold to target solved by bisection on the arc angle |
| Error/SF | ISCWSA MWD error terms (OWSG MWD Rev4-like set: DRFR, DSFS, DSTG, ABXY-TI1, ABZ, ASXY-TI1, ASZ, MBXY-TI1, MBZ, MSXY-TI1, MSZ, DEC, DBH, AMIL, SAG, XYM1, XYM2), ellipses of uncertainty, separation factor vs EDM wells of the chosen slot's site (or SIM offsets) | Williamson H.S., SPE 67616 (2000) "Accuracy prediction for directional MWD"; ISCWSA Error Model Rev 4/5; OWSG. SF = (C-C − Rr − Ro − Sm)/(k·σ), k = 3.5, alert 1.5, stop 1.0 (operator-style rule; editable). Near-vertical XY singularity: XY terms applied on both horizontal axes below 0.5° |
| Physics → T&D | Effective tension and torque for trip out/in, rotate off bottom, rotate drilling, slide; side force; overpull and make-up torque margins; slide lockup | Johancsik, Friesen & Dawson, SPE 11380 (1984) soft-string; Aadnøy et al. |
| Physics → Broomstick | Hookload vs bit depth for FF 0.1–0.4 + rotating line; game hookload overlay (GX.wpgTrace) | Industry practice (Mitchell & Samuel) |
| Physics → Buckling | Sinusoidal / helical limits vs compression | Dawson & Paslay SPE 11167 (1984); Wu & Juvkam-Wold (vertical 2.55/5.55); Chen, Lin & Cheatham (helical = 2√2 × sinusoidal) |
| Physics → String/BHA | Editable string (bit, RSS, MWD, DC, jar, HWDP, 5" DP S-135), BHA weight, available WOB (85%), neutral point | API RP 7G |
| Physics → Bits + ROP | ROP log along the plan, bit per section by UCS (IADC code), bit count | Bourgoyne & Young SPE 4238 (1974); IADC bit classification. Lithology from helper D `GX.strat` (falls back to a SIM column) |
| Physics → Vibration | Stick-slip index vs RPM, lateral and axial critical RPM | Kyllingstad & Halsey SPE 15564 (1988) torsional impedance; Dareing (axial c/4L); pinned-pinned BHA span |
| Environment → MW window | Pore (SIM overpressure ramp), overburden (integrated density), fracture (Eaton 1969), shear collapse (Kirsch inclined hole + Mohr-Coulomb), breakdown | Eaton SPE 2163; Fjaer et al. "Petroleum related rock mechanics"; Aadnøy & Chenevert 1987 |
| Environment → Temperature | Static, drill pipe and annulus temperature, BHCT, flow-line | Holmes & Swift SPE 2318 (1970) steady-state counter-flow |
| Environment → Hookload | Weight indicator at any bit depth / operation; `GX.wpg.hookload(md, op)` API | T&D above |
| Environment → Stuck pipe | Differential, pack-off, geometry, instability risk index | Qualitative index after Bowes & Procter (BP stuck pipe guide) |
| AFE | Time per section (drill, connections, trips, casing, cement/BOP, NPT), cost, P10/P50/P90 Monte Carlo, time-depth curve | Rates are SIM examples (USD); edit in the tab |

## Notes / limits
- The Design tab's **Use this plan** writes W.L / W.S / W.CS. Pressing Calculate in the Proposal tab goes back to wplan's own target-based plan.
- Error model is a teaching implementation; it is not certified for real anti-collision decisions.
- Pore pressure, stresses and rates are SIM unless the user enters real values.

## Hydraulics + ECD (SIM)
- API RP 13D power-law model: n and K from PV/YP (Fann 600/300), pipe and annulus friction per string section, bit pressure drop from nozzle TFA, surface and tool (MWD/RSS) losses.
- Outputs: SPP, ECD at TD, HSI, jet impact, % pressure at bit. Annular gaps < 0.25 in are skipped.
- Check: 1500 L/min -> SPP ~129 bar, ECD 1.235 sg; 3000 L/min -> SPP ~368 bar, ECD 1.317 sg.

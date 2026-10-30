# Well plan: uncertainty, anti-collision vs EDM, cost/AFE (feat/wellplan-ac) — SIM

Module `wplanac.js` adds three tabs to the Well planning panel (wplan.js register pattern): **Error ellipses**, **AC vs EDM**, **Cost / AFE**.
It reuses the engines in `wpg_core.js` (covISCWSA, ellNE/ellPerp, fromPath, sfScan, afe). No new engine.

## Error model
- Station covariance (NEV, 1σ) from `wpg_core.covISCWSA`: ISCWSA error model with OWSG MWD rev5 terms (sensor biases/scale, misalignment, depth, magnetic declination/dip). Random terms accumulate per station, systematic terms across the well (Williamson, SPE-67616 / SPE-90408 "Accuracy prediction for directional MWD"; ISCWSA Error Model Rev 5.x, OWSG set).
- Ellipses: horizontal (N-E) ellipse from the 2×2 sub-covariance, and the ellipse in the plane normal to the hole for 3D; 1σ (blue) and 2σ (yellow). Display scale ×1/5/10/20 for visibility.

## Anti-collision
- Offsets come only from the open EDM site through `GX.edm.ST.R.A.wbs` (no raw file reads), tagged IMPORT. The plan wellhead position on the site grid is an input (default N 0, E 15 m).
- Separation Factor (ISCWSA Collision Avoidance WG, Sawaryn et al. 2019, SPE-194074 "Well-Collision-Avoidance Separation Rule"): SF = (D_ctc − (Rr + Ro) − Sm) / (k · σs), σs = √(nᵀ(Cr+Co)n) along the centre-to-centre line. Defaults k = 3.5, Rr = Ro = 0.108 m, Sm = 0 (brief formula).
- Traffic light: SF < 1.0 red, 1.0–1.5 amber, ≥ 1.5 green.

## Cost / AFE
- Sections between plan casing points (`W.CS`). Days per section: on-bottom (ROP), connections, trips per bit, casing run, flat times (BOP, cement, WOC, logging), NPT allowance — `wpg_core.afe` (IADC daily drilling report time codes; AFE practice per Adams, *Drilling Engineering: A Complete Well Planning Approach*).
- Cost: rig spread rate × days (user input) + DD + bits + casing + mud (1.8 × hole volume) + cement (0.5 × hole volume) + logging + mob + wellhead. Monte Carlo P10/P50/P90. Days-vs-depth chart. Every value is SIM.

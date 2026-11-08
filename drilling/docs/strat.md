# Earth model: lithology and stratigraphy (strat.js, helper D)
Units m (TVD down), gamma API, UCS MPa. Sources in order: WITSML formationMarker / file layers in GEO.layers > EDM CD_WELLBORE_FORMATION rows (window.GX.edmFormations) > SIM default (13 formations, dip 3° to 045°, one normal fault, interbeds). SIM is always labelled SIM.
Lithology colours/patterns follow common mud-log / USGS-FGDC style conventions (sand yellow dots, shale grey-green dashes, limestone blue brick, dolomite purple rhomb, salt crosses, coal black, anhydrite pink hatch). Gamma values are typical published ranges (clean sand 20-50 API, shale 80-150 API, salt/anhydrite <15 API). ROP factor = sqrt(55/UCS)*(1+phi-0.1), clamped; torque factor rises with UCS (same scale as geo.js rockFactors).
API: window.GX.strat = {LITH, SIM_STRAT, fromMarkers, fromEDM, resolve, model, setModel, topAt(M,i,E,N), formationIndexAt, lithAt(M,tvd,E,N), lithAtMD(M,path,md), pointOnPath, gammaAt, response(lith), topsAlongPath, stripLog, surfaceGrid, toGeoLayers, applyToDrilling(on), atBit(), path(), open(tab), close()}. Path = [{md,tvd,E,N}] metres.

## Stage 2b: pressures (SIM)
- Overburden: integral of bulk density over TVD (per-lithology densities, typical Gardner-range values; top 30 m soil 1.9 g/cc).
- Pore pressure: hydrostatic 1.03 SG (sea-water gradient). SIM overpressure: ramp +0.30 SG over 300 m below the first shale seal (disequilibrium compaction, cf. Eaton 1975 / Bowers 1995 concepts). Salt: PP capped at OB.
- Fracture gradient: Eaton (1969) FG = PP + ν/(1−ν)·(OB − PP), ν per lithology; salt FG = OB.
- Mud window: MW (physics P.mud.mw_ppg via window.G.PH) vs PP/FG in SG. States OK / NARROW / KICK RISK / LOSS RISK.
- API: ROCK, pressureAt(M,tvd,E,N), mudWeight(), mudWindow(b), pressureProfile(M,path,step). GEO layers from toGeoLayers now carry pp_ppg/fp_ppg from this model.
- Sources: Eaton, B.A. (1969) JPT "Fracture gradient prediction and its application in oilfield operations"; Eaton (1975) SPE 5544; Bowers (1995) SPE 27488; Gardner et al. (1974) Geophysics.

## Stage 2c: geosteer and well-planning hooks
- `lookAhead(dist_m)`: formation tops the bit will cross in the next dist m (current path).
- `geologyFn(i, azi, E0, N0)`: returns x → {top, base, th, name, lith}, the same shape as geosteer.js `geology(x)`, so helper B can swap the SIM target for a model formation. `formationIndex(name)` finds i.
- `planPath(W)` / `prognosis(path)`: geology prognosis along the wplan planned trajectory (W.S.rows), with PP max, FG min and a mud weight recommendation per formation (PP + 0.06 SG trip margin, capped at FG − 0.06 SG; flag when window < 0.15 SG). These margins are SIM engineering choices for the game, not values taken from a standard.
- Adds a "Geology" tab to Well planning by pushing into `GX.wplan.W.tabs` / `W.ext` (no edit to wplan.js).

## Thin target sub-layer (feat/strat-target, SIM)
- `strat.targetFn(i,azi,E0,N0,M,opts)` returns a thin net-pay bed inside formation i's gross interval: thickness 4.5 ± 1.2 m (min 1.5 m), top at 30 % of gross, 1.2 m undulation (220 m wave), one 1.5 m sub-seismic throw at x = 620 m. `TARGET` holds the defaults. Name ends "target (SIM)"; always SIM.
- geosteer.js uses targetFn when strat provides it (else geologyFn, else simGeology). Source label is forced to SIM when the target is used.
- Why: horizontal wells are commonly landed in 2–8 m beds below seismic vertical resolution (≈ λ/4, 10–25 m), so the bit leaves the bed at faults and undulations and the steerer must react to gamma/resistivity.
- Sources: Widess, "How thin is a thin bed?", Geophysics 38(6) 1973 (λ/4 resolution); Schlumberger Oilfield Glossary "geosteering"; Sheriff & Geldart, Exploration Seismology (2nd ed., 1995) §6.

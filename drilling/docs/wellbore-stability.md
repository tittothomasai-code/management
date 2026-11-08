# Wellbore stability (feat/wbs, helper E, batch6)

Module `wbs.js` (hook: one line in `ext3.js`). Button **Hole stability** opens the Earth model **Strip log** tab. Below the strip log the module adds two tracks on the same MD scale:

- **Mud window** (SG 0.8 to 2.4): pore pressure, shear collapse (zero breakout, dashed), mud weight (white), breakdown (tensile, dashed) and fracture gradient. Green = safe window, orange = collapse zone, red = loss zone.
- **Breakout width** (degrees per lobe, 0 to 180). Green = none, amber = under the allowed width (60°), red = over the allowed width.

A summary line gives the single mud weight window for the whole hole (or "none, set casing"), the widest breakout (depth, rock, azimuth) and kick and loss counts. You can type a mud weight. URL: `?wbs=1.30` opens it with 1.30 SG.

All output is **SIM** (model, not measured). It is never labelled LIVE.

## Method
- Pressures and rock: `GX.strat.pressureAt` (pore, fracture, overburden SG) and `GX.strat.lithAt` + `LITH.ucs` (UCS MPa). No new pressure model.
- Stresses: Sv = overburden, Shmin = fracture gradient, SHmax = 1.10 × Shmin at azimuth 045° (`wpg_core` ENV, SIM normal-fault regime).
- Wall stresses of an inclined hole: Kirsch solution rotated to the hole axis (Fjaer et al. 2008; Zoback 2007 ch. 6). 180 points around the wall.
- Failure: Mohr-Coulomb, σ1' > UCS + q·σ3', q = (1+sin φ)/(1−sin φ), φ = 30°. Breakout width = arc where this is true. Breakout azimuth = point of highest hoop stress (Shmin direction in a vertical hole).
- Collapse mud weight = lowest mud weight with zero breakout; "allowed" collapse = width ≤ 60° (common practice for vertical wells, Zoback 2007). Breakdown = tangential effective stress reaches −T0 (T0 = 0).
- `wpg_core.stability` (well plan) uses its own SIM environment; `wbs.js` uses the strat earth model so the strip log matches the bit HUD.

Test checks: vertical hole collapse and breakdown match the closed forms (3SH − Sh − Pw, 3Sh − SH − Pp), width grows when mud weight drops, inclined hole toward Shmin needs more mud.

## Sources
- Kirsch, G. (1898). Die Theorie der Elastizität und die Bedürfnisse der Festigkeitslehre. VDI.
- Fjaer, E. et al. (2008). Petroleum Related Rock Mechanics, 2nd ed., ch. 4 and 10. Elsevier.
- Zoback, M.D. (2007). Reservoir Geomechanics, ch. 6 and 10. Cambridge University Press.
- Aadnøy, B.S. & Chenevert, M.E. (1987). Stability of highly inclined boreholes. SPE Drilling Engineering 2(4), SPE-16052-PA.

## Limits
Linear elastic, no time effects (salt creep, shale swelling), no thermal or chemical terms, constant stress ratio. Use for training only.

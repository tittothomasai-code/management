# Hydraulic fracturing stage (SIM)

Files: `fraceng.js` (pure engine), hooks in `woeng.js` (job `frac`, `stratReady`) and `workover.js` (frac spread, fracture wings, chart, HUD). Test: `frac_test.mjs` (shots `shots_live/141_frac_*`).
Open: Workover tile → job "Hydraulic fracturing: plug-and-perf, 3 stages", or `?workover=frac`. All data SIM.

## What it does
- Frac spread in 3D: 6 pump trucks, blender, data van, sand silos, missile manifold, treating iron to the frac tree.
- Plug-and-perf, 3 stages bottom up (2550, 2390, 2290 m): wireline guns, pump-down composite plug, perforate, pump, flush, ISIP; then CT mill-out and flowback.
- Pumping schedule per stage: pad, 1–5 lb/gal (ppa) proppant ramps (1 ppa = 119.8 kg/m³), flush = casing volume to the top perf.
- Live chart: treating pressure, rate, bottomhole proppant concentration (casing-volume lag), ISIP label.
- HUD: rate, treating pressure vs. 69 MPa limit, BHP, net pressure, xf, hf, width, screenout risk.
- Fracture wings grow in 3D (cut-away scale) from the PKN model; propped area shown in orange.
- Stage 3 is an aggressive design (thin fluid, 8 ppa, higher leak-off): width falls under 3 × proppant diameter and in-fracture concentration rises → screenout, pressure spike, sand cut to flush.

## Methods and sources
- Stresses: Sv = 0.0226 MPa/m (2.3 SG overburden), Pp = 0.0107 MPa/m, Shmin = ν/(1−ν)(Sv − αPp) + αPp + 1.5 MPa tectonic (Eaton 1969, SPE-2163; Zoback, *Reservoir Geomechanics* 2007). Lithology per depth from helper D's `strat.js` (`SIM_STRAT`, `lithAt`) when present, else a SIM layer fallback; elastic values (E, ν) per lithology from Fjær et al., *Petroleum Related Rock Mechanics* (2008).
- Geometry: PKN (Perkins & Kern 1961, JPT; Nordgren 1972, SPEJ): w_max = 2.31 [q μ (1−ν) x_f / G]^¼, P_net = E′ w_max / (2 h_f). Length by volume balance with Carter leak-off (V = 2 x_f h_f (w̄ + 2κ C_L √t + S_p)) — Economides & Nolte, *Reservoir Stimulation* 3rd ed. (2000) ch. 5–6; Economides, Hill & Ehlig-Economides, *Petroleum Production Systems* ch. 17.
- Height growth: frac enters layers whose Shmin < σ_pay + 0.8 P_net (equilibrium-height idea, Simonson, Abou-Sayed & Clifton 1978, SPEJ). Capped at 90 m.
- Treating pressure: P_surf = Shmin + P_net + pipe friction + perf friction − slurry hydrostatic. Perf friction Δp = ρq²/(2C_d²A²) (Crump & Conway 1988, SPE-15474). Pipe friction: Fanning/Blasius × friction-reducer factor.
- ISIP = surface pressure just after shut-in; BH ISIP = ISIP + hydrostatic; net pressure = BH ISIP − Shmin; frac gradient = BH ISIP /(g·TVD).
- Screenout: bridging when w̄ < ~3 × proppant diameter (Gruesbeck & Collins 1982) or in-fracture slurry nearing packed concentration (Nolte 1986 tip screenout; Nolte–Smith log-log slope interpretation).
- Plug-and-perf practice: API RP 100-1/100-2 (well integrity and fracture containment), API RP 19C proppant.

Simplified teaching model; not for real treatment design.

## Stresses from strat.js (v5.10.0+)
When helper D's strat.js is present, `useStrat(S)` takes `M=S.model()` and each depth calls `S.pressureAt(M,tvd)` (Eaton per bed).
Sv, Pp and Shmin come from its `ob_sg`, `pp_sg`, `fg_sg` (SG) via p[MPa] = SG × 9.80665 × TVD / 1000, cached per metre.
The stage "frac gradient" shown is the strat FG in SG at the perf depth; the ISIP gradient (ISIP_bh / TVD, SG) is shown separately,
because after a screenout it includes the extra net pressure and is not the formation frac gradient. Without strat.js: SIM fallback (uniaxial-strain Shmin).

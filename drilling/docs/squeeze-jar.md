# Squeeze cementing and jar blow (helper F) — SIM

Module `woeng4.js` (pure), tabs in `wo4.js`, shown as **Squeeze** and **Jar blow** in the wo2 panel (Workover ▸ 📋 CT, fishing, P&A). Builds on woeng2 (pressTest, jarImpact) and woeng3 (cap, balanced plug). All values SIM.

## Squeeze cementing (cement retainer, low-pressure hesitation squeeze)
- Injection test: injectivity II = q / (BHP − P_res). Surface limit = frac pressure at top perf − safety margin − fluid hydrostatic, so the squeeze stays below frac (low-pressure squeeze; Nelson & Guillot, *Well Cementing* 2nd ed., ch. 14 "Remedial cementing"; API RP 65-2 zonal isolation).
- Slurry: casing volume retainer→perf base + squeeze volume into perfs (SIM rule 0.05 m³/m perforated, scaled by injectivity) + 20 % excess. Displacement = tubing capacity to retainer, leave 0.16 m³ (1 bbl) in tubing (under-displacement).
- Hesitation: stages of ~0.16 m³, hold 10–15 min; filter-cake build-up raises pressure each stage until the final squeeze pressure (SIM curve). Job time must be ≤ 75 % of slurry thickening time.
- Sequence (12 steps): set retainer 5–30 m above perfs, test, injection test, pump, displace, hesitate, hold final pressure, sting out + reverse out, POOH, WOC, drill out + pressure test (woeng2.pressTest), inflow test. Squeezed perfs as a barrier element: NORSOK D-010 rev 5 (verify by pressure/inflow test); OEUK Guidelines for the abandonment of wells, Issue 7.

## Jar blow
- Stress-wave model: impedance Z = E·A/c, c = √(E/ρ) ≈ 5135 m/s. Released overpull T gives hammer speed v0 = T/Z_pipe. Accelerator adds spring energy ½·T·stroke: v = √(v0² + T·s/m_collars).
- Peak impact at the fish ≈ Z_collar·v, duration 2·L_collar/c, impulse m·v (Skeem, Friedman & Walker, "Drillstring dynamics during jar operation", JPT 1979 / SPE 7337; Kalsi et al. SPE 16070 jar placement).
- Jar window: hook load to fire = buoyed string weight above jar + overpull ≤ 80 % pipe yield; overpull ≤ jar rating; jar above the stuck point. Free stretch / energy reuse woeng2.jarImpact.

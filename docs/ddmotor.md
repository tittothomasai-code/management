# DD Training: mud motor management (helper DD-motor)
Module: `ddmotor_core.js` (pure engine) + `ddmotor.js` (panel). Open with `?demo=ddmotor`, or from the DD cabin via `GX.ddcab.motor`.
All motor specs are generic SIM values, not a vendor sheet. Never LIVE.

## Hook API (`window.GX.ddcab.motor`, also `window.DDMOTOR`)
- `mount(el)` – render the panel inside a cabin container (for the cabin's Motor tab). `open()` / `close()` – overlay panel.
- `step({flow,wob,rpm,rotating,tvd,inc,tf,bend,hours})` – drive the motor from the cabin's drill loop; returns state + health.
- `state`, `health`, `sess`, `C` (engine functions: `state`, `yieldDLS`, `slideFor`, `rotateLimit`, `wearStep`, `health`, `STALL_STEPS`).

## Methods
- Motor RPM = flow × rev/volume (PDM rev/gal from handbook spec sheets, converted to rev/L). Load slip: RPM falls with (dP/dPmax)².
- Bit torque from WOB: T = μ·WOB·D/3 (Pessier & Fear 1992, SPE 24584). Motor torque ∝ diff pressure (torque-per-bar spec), so dP = T / k.
- SPP = off-bottom SPP + diff pressure (standard DD practice: read diff P as on-bottom minus off-bottom SPP). Stall when dP ≥ 1.35 × rated max (SIM): RPM 0, SPP spike, recovery steps (pick up, let SPP settle, half WOB, step up).
- Motor yield: three-point geometry, DLS = 2·bend/(L1+L2) × 30 m (bit-to-bend, bend-to-stabiliser contact).
- Rotate-with-bend limit: SIM table, 80/60/45/30/0 RPM for ≤0.78/1.15/1.5/1.83/2.12°.
- Toolface: MTF below 5° inclination, GTF above. Reactive torque turns TF left as dP rises (SIM 1.2°/bar) when sliding.
- Wear: stator equivalent hours weighted by (0.3+load²), ×2 per 10 °C above (rating − 30 °C) (elastomer Arrhenius rule of thumb), ×20 during a stall; bearing wear by hours and WOB. Pull at <15 % or 5 stalls.
- Temperature: SIM geothermal 20 °C + 3 °C/100 m TVD + motor heat.

## Sources
- NOV / Halliburton / Schlumberger PowerPak PDM handbooks (performance curves, rev/gal, max diff pressure, stall).
- Pessier, R.C., Fear, M.J., "Quantifying common drilling problems with mechanical specific energy", SPE 24584 (1992).
- Standard slide sheet practice (motor yield, slide/rotate ratio), IADC Drilling Manual, directional drilling chapter.

# Geosteering SIM demo (?demo=geosteer), helper B

All data is SYNTHETIC and labelled SIM. Nothing is read from WITSML, Supabase, Adaga or EDM.

## Model (geosteer.js, pure functions: geology, gamma, resist, model)
- Target sand: top dips 1.2° down along the well with a small undulation. A SIM normal fault at 520 m drops the layer 4 m. The layer gets thinner, from 6 m to 4.5 m.
- Gamma (gAPI): about 35 in the sand and about 135 in the shale above and below, with a logistic change over about 0.35 m at each boundary and a "hot" streak at the top. The values match the published ranges: quartz sandstone 15–30, shale 60–150 API (AAPG Wiki, Quick-look lithology from logs; KGS Bulletin, The Gamma Ray Log).
- Resistivity (ohm·m): 8–60 in the sand (higher away from the boundaries) and 2–6 in the shale. Plotted on a log scale.
- Steering: a station every 5 m and a decision every 30 m. Rule: gamma above 80 gAPI means the bit is out of the sand. Steer toward the layer (down if the bit is in the upper half, up if it is in the lower half). Inside the layer, hold the inclination that follows the formation dip, with a small correction to keep the bit in the middle third. The build/drop rate is limited to 3°/30 m.
- MD = SIM heel at 3200 m + path length. Result: the bit stays in the layer for about 96% of the lateral. At the fault it leaves the layer, gamma goes up to 121, and the decisions are "Steer down", then a return to the layer.
- Simplification (stated in the app): the decisions use the true position in the layer, so there is no interpretation uncertainty. A later stage could use the lithology/strat API from helper D and a typelog correlation.

## Sources
- AAPG Wiki, Quick-look lithology from logs: https://wiki.aapg.org/Quick-look_lithology_from_logs
- KGS, Geological Log Analysis, The Gamma Ray Log: https://www.kgs.ku.edu/Publications/Bulletins/LA/03_gamma.html
- Petro Shine, Drilling measurements and logging tools in geosteering (LWD GR used for bed-boundary correlation): https://petroshine.com/drilling-measurements-and-logging-tools/2/

## v2: earth model (helper D, strat.js)
- The target layer is `GX.strat.geologyFn(GX.strat.formationIndex('reservoir'), 45)`, a drop-in for `geology(x)`. Logs, decisions and the curtain all use it. The bit starts at 58% of the layer thickness.
- "Tops ahead" uses `GX.strat.lookAhead(150)`. The `strat:bit` event shows "Rig bit: entered <formation> (<lith>) at MD …".
- Fallback to the SIM layer (with its SIM fault at x = 520 m) if GX.strat is missing, has no reservoir formation, or returns bad values. The reason is shown in the panel.
- Label: SIM stays unless the earth model source is real data (WITSML/EDM). The demo never shows LIVE.

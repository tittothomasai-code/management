# Subsurface target band (feat/target-sub, helper D)
The band is **SIM** and is never labelled LIVE. `subtarget.js` belongs to helper D. `subsurface.js` belongs to helper C, and this feature only adds one hook line there.

- `build()` in subsurface.js sends `dw-sub-build` {group, THREE}. subtarget.js then adds the `target_band_SIM` group: top and base sheets (±60 m across the section), edge lines and a "TARGET (SIM)" label.
- The geometry comes from `strat.targetFn(reservoir, 45°, 0, 0)`, sampled every 25 m to 1500 m. This is the same function that geosteer and target2 use, so a `setTarget()` change shows up on the next rebuild.
- `GX.subtarget.stats()` and `GX.subtarget.sample()` are there for tests.

## Sources
- Thin target and seismic resolution (λ/4): Widess, M.B., "How thin is a thin bed?", Geophysics 38 (1973).
- Geosteering target windows: Bourgeois et al., SPE 77526; strat.js TARGET notes.

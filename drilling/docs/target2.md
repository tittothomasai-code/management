# Target 2 (helper D): editable target sub-layer — SIM

- `strat.js`: per-well target thickness (0.5–20 m), dip (±5°) and position in the reservoir (fraction), stored in localStorage `dw_target_v1`, event `strat:target`. `targetFn` applies the edits, so geosteer (via `useEarthModel`) follows with no code change.
- New "Target" tab: section with the sub-layer and well path, in-zone / out-of-zone % (`zoneStats`).
- Gamma contrast at top and base of the target (`targetGamma`, `targetContrast`), SIM API values.
- Strip log: yellow "TARGET (SIM)" band. The band is drawn in strat's strip log, not in `subsurface.js` (owned by helper C).
- Sources: Rider & Kennedy, "The Geological Interpretation of Well Logs" (3rd ed., 2011) for gamma response of shale/sand; Stoner et al., "Geosteering" practice notes, and SPE 79915 (geosteering in thin beds) for in-zone % as a KPI; dip effect TVD = TVD₀ + x·tan(dip) (apparent dip geometry).

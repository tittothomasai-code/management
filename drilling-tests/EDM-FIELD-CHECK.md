# DR101L field placement and 10 km screening

Open the game, choose Plan, then Import EDM, then **Open DR101L field · 10 km check**.
The existing additive importer backs up the on-device EDM library, preserves other
imports and opens the supplied field. The check also has a **10 km check** button
in every EDM map. Import surrounding EDM files and run again to include them.
Export report saves every comparison, including results beyond the UI's first 60.

## Coordinate provenance

The supplied `DR101L WB04 DD EOWR.xlsx` has zero coordinates in `1.1!D24:D27`.
Its summary says GDA94 while the detailed slide sheet says GDA2020. Those cells
cannot locate the well. No coordinates are inferred from the workbook zeros.

The original well-folder EDM model is already published at
`data/dr101l-edm-world.json`, imported from `DR101L.edm.xml`. It declares GDA2020,
UTM/MGA zone 55 south and Mean Sea Level. Its site map coordinates are
805279.555996779 E / 7255911.811970977 N. The well map coordinates are rounded;
the single-well site's precise coordinates agree within 0.2 m and are retained.
This agrees with the published planning package at
`data/dr101l-wellplans.json` (805279.56 E / 7255911.81 N).

The EDM contains one well with four **planned** branches, not four drilled
offset wells. The original signed MSL Z values are retained. The original
visual map placement is reused without changing user placements or other wells.

## Assessment and limits

The worker reads all EDM datasets saved on the device plus the open model.
It selects compatible offset trajectories intersecting a horizontal 10000 m
circle around the reference wellhead, including segments whose endpoints and
wellhead are outside the circle. It compares all selected segments against all
reference segments using exact piecewise-linear 3D closest approach. There is
no 40-path assessment cap. Same-well branches are excluded from offsets.

Horizontal zone, hemisphere, datum and declared vertical datum must agree.
Unknown/mixed frames and invalid/missing trajectories are reported as skipped;
no datum transformation or zero-coordinate placement is invented. The reference
model uses display-decimated paths, so omitted stations are not assessed.

The existing simplified uncertainty cone, radius = 1 m + 1% MD, supplies a
conservative segment SF lower bound. STOP is below 1; REVIEW is below 1.5.
This is screening only, without a validated survey-error model or regional
inventory completeness. No operational clearance is issued by any result.

With the actual supplied source alone there are **zero offset trajectories,
zero assessed pairs and an INCOMPLETE result**. To assess the surrounding field,
the user must load its offset trajectories. This workspace cannot read a
different device's IndexedDB library. Nothing is posted to a server.

## Verification

`npm test --prefix drilling-tests`: 59 passing tests, including segment
intersections, degenerate/parallel geometry, crossing-radius selection, 45
offsets without truncation, mixed datums, missing coordinates and honest
no-offset/decimation reporting.

`PLAYWRIGHT_MODULE=playwright node drilling-tests/edm-field-browser.mjs`:
desktop 1920×1080 and phone 390×844 pass with authentic production-source
fixtures. Checks exact placement, four planned references, INCOMPLETE output,
JSON export, preservation of an existing SIM library record, no horizontal
overflow, no page errors and no external requests. Fixtures snapshot the
already-public model/importer; the local server mirrors Netlify's vendor-path
case handling. Evidence is under `edm-field-evidence/`.

The release workflow additionally checks the actual unpublished deploy using
the real Plan → Import EDM → DR101L action on both screen sizes, alongside
existing Ops, Tally, BHA, directional workspace and menu checks. It preserves
the complete published inventory and refuses promotion after any failed check.

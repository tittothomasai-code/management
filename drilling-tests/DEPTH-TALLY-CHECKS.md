# Depth, BHE and tally checks

Ops: expand **Pipe-length / tally checks** in the Joint card. The same checks appear below the Joints dashboard. In its Tally tab, completed correlated BHE strokes supply derived lengths. Imported and entered measurements remain authoritative and editable on this device.

A cycle compares the previous connection top BHE with the next connection bottom BHE. Downward travel must agree with MD gain within 0.30 m, have at least two correlated sample pairs and cover both endpoints. Negative BHE offsets do not change travel. Known length units are converted before comparison. Missing samples, pickups, reaming, reported off-bottom bit depths, inconsistent movement and possible multiple-joint gaps require review. An unverified MD interval is never promoted into the shared tally as a measured pipe length. CSV export preserves both readings and the reasons for review.

A depth log cannot prove connection timing or off-bottom activity between samples. These are derived lengths, not a substitute for calibrated pipe measurements. The current incomplete joint retains a nominal or measured tally target. An unavailable bit depth never silently becomes hole depth. Valid off-bottom bit depths remain separate; a bit below the hole is flagged and excluded from tally counts.

Validation: 35 unit tests plus the actual Ops and Tally source running in desktop (1920×1080) and phone (390×844) browsers, using local synthetic WITSML transport only. Tests exercise valid strokes, disagreement, source gaps, feet/offsets, missing/invalid/off-bottom bit, CSV download, manual edits, blocked promotion of uncertain lengths, and the existing pump/top-drive and survey alerts. Production parsers and tally calculation dependencies are captured under fixtures/survey-alert; navigation and upstream transport are stubbed. The release workflow additionally tests the actual unpublished site with its normal modules and preserved game inventory before publication.

## Independent comparison in the Tally tab

The supplied DR101L WB04 workbook contributes 189 measured inventory entries for WB04B01. All entries remain inventory, independent of whether drilling details are filled in. Only the numerical inventory, source row references, run offsets and source SHA-256 are bundled; the workbook itself is unchanged. The detailed header alias DR0101L is retained in source metadata, while the user identified this inventory as DR101L. Exact well/branch matching prevents it appearing for another well.

The comparison preserves BHE-only derived lengths before any measured-tally checks. The measured reference never fills a missing derived value. Per-cycle differences and cumulative differences are separate; cumulative results stop across missing or invalid cycles. Partial log windows explicitly retain an unverified earlier prefix. Multiple short inventory entries can match one observed stroke, without assuming they are separate complete physical joints. Inventory entry IDs label derived rows when MD endpoints align, without replacing derived lengths. Current partial rows show their measured inventory target instead of using 13 m.

Starting reference: 48.53 m BHA + 774.00 m carried string reference = 822.53 m MD. The carried value is the remainder of the supplied starting depth, not a reconstructed measurement of all previous joints. The BHA is already included in the starting MD and is never added again to derived cumulative MD. Existing operator-entered BHA values are preserved.

41 unit tests and desktop/phone browser tests cover BHA accounting, independent discrepancies, cumulative drift, missing cycles, grouped initial short entries, exact scope, all 189 entries, the live Tally-tab renderer, aligned numbering, measured current target and CSV download. SIM transport is used only for tests. Actual authenticated WITSML agreement remains a live-data result, not an assertion made from the measured workbook.

## Ops joint-card reference correction

Ops loads the same measured reference directly, without requiring the Tally tab
to have been opened. At 2,618.90 m MD, the supplied inventory places the depth
within entry 208 (2,610.62–2,623.01 m, length 12.39 m), rather than estimated
connection count 223. The card uses the measured start, length and endpoint and
labels its number as an MD reference. Actual reported bit MD takes precedence;
when unavailable, hole MD is a depth reference and never claims a bit position.
The BHA remains included once in the source 822.53 m starting MD.

Reset candidates are not renumbered consecutively from that reference. The
axis and recent-interval list label a measured entry only when its MD endpoints
align; otherwise they remain BHE/reset intervals. A reset at 2,609.20 m differs
from the measured entry start by 1.42 m and stays visibly flagged for review.
No sensor samples or detector outputs are changed to force the match.
43 unit checks and desktop/phone Ops tests cover the supplied screenshot depths,
reference loading before opening Tally, progress 8.28/12.39 m, the 1.42 m
discrepancy, bit-MD precedence, and other-well reference clearing.

## Measured hardpoints and uploaded references

Ops and Tally now accept measured hardpoints with an AEST timestamp, exact
well/bore/run scope, measured joint, cumulative MD, BHA, recorder and source.
A point can be at a joint end or within a joint with an explicitly measured
advance. Midnight is 00:00 AEST (UTC+10); an unconfirmed midnight is due, never
filled with an estimate. The anchor corrects subsequent reference numbering
and can resume anchored cumulative BHE at a complete matching joint-end
checkpoint. Raw BHE lengths, source rows and pre-anchor history remain intact.
BHA is included once; any datum correction is shown separately.

History is appended on this device. Revisions and retractions keep previous
records; reload and exact-scope JSON export/import are supported. There is no
team-wide server persistence or unattended collection of midnight measurements.
All hardpoint fields require explicit measured values and a source. Forms
survive polling refreshes. Other well/bore/run records cannot be applied.

Upload measured tally reads CSV/XLSX as a separate reference. Multi-sheet XLSX
files use the tally/slide worksheet, with a worksheet selector and a review of
starting MD, BHA and run ID before applying. Uploads stay on the device and
retain earlier revisions. Joint/cumulative mismatches, gaps, BHA differences
and sparse BHE remain flagged. A green arithmetic total is no longer presented
as independent verification. The source sheet and sensor data are not changed.
52 unit checks plus desktop/phone browser checks cover midnight boundaries,
anchor accounting, history/retraction/reload/export/import, scope denial, sparse
prefixes, mixed length units, multi-sheet uploads and inconsistent cumulative MD.

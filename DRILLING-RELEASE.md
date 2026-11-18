# Drilling production release

Published and independently verified on 18 November 2026:
https://drilling.robotyx.systems/ops

- Netlify deploy: `6afd11726f5e4201ff542b17`
- Immediate rollback: `6af98c5e85ea8d0a2afbca02`
- Feature source: `67a7835ce911b7fe765d19900830f486811a8612`
- Release workflow: https://github.com/tittothomasai-code/management/actions/runs/44225630982
- Original production inventory: 515 files. New inventory: 578 files.
- Four existing files changed: index.html, ops.html, wellplan.html and opsnow.js.
- All original paths retained; 511 other production files preserved byte-for-byte.
- No functions or server runtime existed on this static Netlify site.

The real dashboard now includes subtle WITSML pump status and top-drive position,
with source-aware unavailable states. The survey receipt popup and BHA access in
Tools, Ops, Well Plan and Directional Drilling are released. WITSML authentication
and existing external data connections are preserved. No simulation transport or
test exports are included in production; SIM fixtures remain test-only.

## Automatic GitHub releases

The publishing branch is `release/drilling-live`. Push reviewed Ops/BHA runtime changes to that branch to start the GitHub Actions release pipeline. Feature branches and the corporate main/root page are not automatically published.
Changes to other native game modules require an explicitly reviewed overlay; the
workflow deliberately does not deploy the partial legacy checkout.

The pipeline reads the current Netlify file inventory, preserves unrelated files
by their existing content hashes and prepares an unpublished draft with the
reviewed overlay. It runs unit and local-fixture tests plus actual desktop/phone
browser checks against that draft. Only then does it promote the draft. It checks
production content hashes and restores the previous deploy on a verification
failure. Existing native assets and Field modules are not replaced by this older
repository baseline. Never deploy the entire partial checkout over production.

The repository Actions secret NETLIFY_AUTH_TOKEN is read only by the release job.
It is never saved in source, build artifacts or logs. The workflow has read-only
GitHub contents permission and does not write commits or messages.

For a future Ops source change, update survey-source.json to the reviewed current
production Ops SHA before publishing. The source guard refuses to overwrite
concurrent unreviewed Ops changes. Keep the additive entry patches and the old
inventory-preservation checks. Release evidence and screenshots are attached to
the successful Actions run for seven days.

## BHE/Flow and SPP follow-up, 18 November

Published deploy: `6afd4de498f4c455b6422591`. Rollback: `6afd11726f5e4201ff542b17`.
Workflow: https://github.com/tittothomasai-code/management/actions/runs/44255970608

The active depth log now supplies reported BHE/Flow instead of hiding those
readings. Updates at the same MD refresh the tail without inventing drilled depth.
SPP provides a labelled pump-activity inference only when flow is unusable; no
uncalibrated numeric flow is fabricated. 22 unit checks and desktop/phone preview
checks pass. Production hashes for the Ops entry, module and widget assets were
independently verified after publication.

## SPP threshold rule

Published deploy `6afd52cd70be04cf2d2b309f`; rollback `6afd4de498f4c455b6422591`.
Workflow https://github.com/tittothomasai-code/management/actions/runs/44258682463
SPP above 100 psi now indicates pumps on when Flow is unusable, labelled inferred.
At or below 100 psi is unconfirmed. Unit conversion and direct-flow precedence
are tested. 23 unit tests and desktop/phone preview suites passed. Production
entry and module hashes independently verified. Survey popup remains enabled.

## Joint/BHE comparison correction

Deploy `6afd571131294b26ddb556f2`; rollback `6afd52cd70be04cf2d2b309f`.
Workflow https://github.com/tittothomasai-code/management/actions/runs/44261048953
Joint target now uses known tally length or explicit 13 m nominal. MD connection
spacing is no longer called measured block travel or used to overwrite that target.
Observed current-cycle BHE travel is shown separately. BHE units are normalized
for detection/comparison. 28 unit checks and desktop/phone tests passed; deployed
Ops entry, module and joint helper hashes independently verified.

## Correlated BHE lengths and depth/tally integrity

Deploy `6afd630b57c057fcba87b222`; rollback `6afd571131294b26ddb556f2`.
Runtime head `eaf4478171a09aff5400f208e2c837af9aa880fa`.
Workflow https://github.com/tittothomasai-code/management/actions/runs/44268106235

Completed, correlated BHE strokes now supply labelled derived lengths in the
existing Tally board. MD advance, BHE travel, bit depth and imported cumulative
tally endpoints are checked separately. Pickups, incomplete samples, off-bottom
readings and disagreements remain provisional. Invalid intervals cannot silently
promote a physical pipe length into the shared tally. Imported/entered lengths
are preserved. Ops and Joints show expandable checks with a CSV export.

Missing bit depth no longer inherits hole MD internally. Fresh off-bottom bit
depths remain separate, impossible source bit depths are flagged and excluded
from tally counts, and reported length units are converted. Fixed re-entrant
refresh during tally-cell editing. Source changes are guarded for both Ops and
Tally; all previous production file paths were preserved.

35 unit tests and desktop/phone browser tests passed, including the actual
Tally board, derived lengths, review blocking, CSV export, edits, missing/invalid
bit depth and existing pump/survey alerts. Actual unpublished-site Ops, Tally,
game and DD checks passed before promotion. All four changed entry/runtime
files independently matched production SHA-256 after publishing. Detailed
assumptions and test scope: drilling-tests/DEPTH-TALLY-CHECKS.md. These are
derived estimates; a depth log cannot prove off-bottom timing between samples.

## Independent derived vs measured Tally comparison

Published deploy `6afd6d9f1ddb5a68fafa1e5d`; rollback `6afd630b57c057fcba87b222`.
Runtime head `7777aa64d06d873ee5f92d481d5d39efb35e9e9d`.
Workflow https://github.com/tittothomasai-code/management/actions/runs/44274798931

The Tally tab now loads all 189 numerical inventory entries from the supplied
DR101L WB04 DD EOWR workbook for DR101L/WB04B01 only. The measured reference
is separate from independent BHE results, with per-cycle length and cumulative
differences, aligned entry numbers, missing-coverage notices, inventory expansion
and CSV export. Existing CSV/XLSX exports include the comparison. A measured
discrepancy no longer erases the independent BHE result. Blank drilling details
never classify inventory as unused. The original workbook is unchanged.

BHA reference: 48.53 m + carried string reference 774.00 m = 822.53 m starting MD.
The carried value is inferred from the supplied starting reference, not measured
prior-pipe detail. BHA is already included in MD and is never added twice.
Operator-entered BHA values remain intact. Partial log windows do not claim a
full run reconciliation. The measured target replaces the nominal label on
aligned current partial entries without copying its length into derived data.

41 unit tests and desktop/phone browser suites passed, followed by actual
unpublished-site acceptance. All six entry/runtime/reference files independently
matched production hashes, and every published inventory entry plus BHA/start
values matched the original workbook. Full agreement with authenticated live
WITSML history is not asserted: the tab reports match/review/missing coverage
from whatever real BHE data the signed-in operator receives.

## Ops estimated joint 223 correction

Deploy `6afd7022f8fc82b187ad2d1b`; rollback `6afd6d9f1ddb5a68fafa1e5d`.
Runtime head `f93b9fe815481a6874695ae561e75f60e6380ac2`.
Workflow https://github.com/tittothomasai-code/management/actions/runs/44276474420

Ops now loads the measured reference without opening Tally first. The supplied
screenshot depth 2,618.90 m maps to inventory entry 208 at 2,610.62–2,623.01 m,
with 8.28/12.39 m advance. Entry 223 instead spans 2,796.74–2,809.08 m.
The card labels the number as an MD reference, retains the single BHA inclusion
in the starting depth, prefers valid bit MD, and keeps hole MD as a reference
when bit depth is unavailable. The latest reset at 2,609.20 m is 1.42 m before
the measured start and remains flagged; sensors are not adjusted to force it.
History and axis labels no longer decrement a joint number across unaligned
BHE resets. 43 unit tests and desktop/phone local and real-preview checks passed.
All four changed entry/runtime assets independently matched production hashes.

## Measured hardpoints and reference uploads

Deploy `6afd784d2f3c9d52c9fa2293`; rollback `6afd7022f8fc82b187ad2d1b`.
Runtime head `7ed8fcbc7c24916c0aeaaf15e59f746809cda7fd`.
Workflow https://github.com/tittothomasai-code/management/actions/runs/44281938330

Measured AEST hardpoints are available in Ops and Tally. Explicit midnight
confirmation is due each day; no unattended measurement is invented. Joint-end
or partial-joint points carry MD, BHA, source and recorder, with an append-only
local revision/retraction history and exact well/bore/run-scoped export/import.
Anchors adjust subsequent reference numbering and can resume corrected BHE
cumulative totals at a matching complete anchor; raw values and pre-anchor
history remain separate. Data stays on this device, without server sharing.

CSV/XLSX measured uploads are now separate references, with multi-sheet
selection, starting MD/BHA/run review, retained upload revisions, and visible
length/cumulative/BHA/gap inconsistencies. The derived data is not overwritten
by uploads. Arithmetic consistency is no longer shown as independent agreement.
52 unit tests and desktop/phone browser tests passed before real-preview checks
and publication. Five changed runtime modules matched independent live hashes.

## DR101L EDM location and 10 km field screening

Deploy `6afd89b9f29dfb8aa3bf1226`; rollback `6afd784d2f3c9d52c9fa2293`.
Release head `27fedf7879e6e360e151d2a2e4427086b0d35347` (runtime change
`9e2c50b32c24569f47edffe663333f5864c88941`).
Workflow https://github.com/tittothomasai-code/management/actions/runs/44293565043

Plan → Import EDM → Open DR101L field · 10 km check opens the existing
additive well-folder importer and the EDM map. The original EDM's precise site
location is E 805279.555996779 / N 7255911.811970977, GDA2020 / MGA zone 55
south, agreeing with the existing planning package. Workbook coordinates are
zero, with conflicting datum labels, and were not used. Existing saved imports
and the importer's backup/preservation behavior remain intact.

The worker screens all compatible saved offset trajectories intersecting a
10 km horizontal radius, without the old 40-path cap. It reports piecewise-linear
3D closest approach and conservative simplified-cone SF bounds, explicit datum
skips and display-decimation limits. It exports every result. This is not
operational clearance or a complete regional-inventory search. The actual
provided model has four planned branches and no surrounding offsets: **INCOMPLETE,
zero offset trajectories and zero assessed pairs**. Each device's own saved EDM
library is searched when opened there; no remote library access is implied.

59 unit tests and desktop/phone source-fixture browser tests passed. The actual
unpublished deploy passed Ops/Tally, BHA, directional workspace, menu and EDM
location/incomplete-report checks on both screen sizes before promotion. The
acceptance test explicitly closes the DD overlay before navigating to EDM. Five
changed EDM runtime files independently matched live SHA-256 hashes. See
`drilling-tests/EDM-FIELD-CHECK.md` for provenance, limits and reproducible tests.

## Reported end of drilling and liner phase

Deploy `6afd8f11cc56bb7fc226a53d`; rollback `6afd89b9f29dfb8aa3bf1226`.
Runtime head `6041e5d5f522ea8d2e0865c362c5eb41d6236eda`.
Workflow https://github.com/tittothomasai-code/management/actions/runs/44297037073

The user supplied the DR101L WB04B01 entire-lateral summary and reported liner
running on 18 November 2026 AEST. The dated report records KOP 822.53 m MD,
TD 2618.90 m MD, lateral 1796.37 m, in-seam 1774.37 m (98.78%), faulted exits
1826–1832 and 2223–2239 m MD (22 m total), no stratigraphic exits, and the
reported TD reason. Exact operational times, liner depths/counts and the
measured final drilling joint count were not supplied and remain unknown.

Ops displays the dated human phase separately from telemetry. Historical
positive depth-log rates cannot imply ongoing drilling or derive missing
bit depth. Raw source readings remain visible; depths beyond reported TD
are flagged. The final inventory reference is fixed at reported TD, not
subsequent tool depth, and remains an MD reference rather than a confirmed
pipe count. The active progress bar/next-connection expectation is replaced
with a completed-drilling label. Tally identifies historical/partial drilling
coverage; later time-log activity cannot create liner counts or establish
that the old drilling string remains in the hole. Midnight reminders pause
for this historical drilling run; retrospective measured anchors, uploads,
BHA, revisions and raw history remain available. EDM plans are unchanged.

64 unit tests and desktop/phone browser tests passed, including fresh-looking
old drilling rates, missing bit, current tool position, wrong-bore exclusion,
report-date gating, TD reference preservation, conflict without clamping,
paused reminders and historical tally labels. The actual unpublished deploy
passed existing Ops/Tally, BHA, DD, menu and EDM checks and scoped report module
checks before promotion. All four changed runtime files independently matched
live SHA-256 hashes. See `drilling-tests/END-OF-WELL-REPORT.md`.

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

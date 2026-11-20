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

## Hidden landing planner, response analysis and how-to simulation

Deploy `6afe6caf49670fd2f5cea816`; rollback `6afd8f11cc56bb7fc226a53d`.
Runtime head `2994c1ed3c992c5b3bc3ff24022fe0f30c876576`.
Workflow https://github.com/tittothomasai-code/management/actions/runs/44451560929

Q opens the landing popup; phones use Settings → Advanced tools → Landing
planner · Q, or `/ops?landing=1`. It supports MD/angles and local N/E/TVD/angles
targets, ten scenarios, peak DLS/margins, geometry plots, explicit assumptions,
JSON/CSV exports and the best feasible candidate in the generated family.
Existing minimum-curvature geometry and the saved BHA design library are reused.
The planner never replaces the active well plan or writes to WITSML.

New complete surveys and confirmed projected hole-depth changes recalculate
without overwriting dirty inputs. An unsurveyed interval requires explicit
last-tangent projection confirmation or a reviewed manual tie-on. Such a
projection is never added to measured BHA-response statistics. Completed bore
data cannot become live next-well observations. Well/bore/operator changes
clear results and isolate saved targets. The current reported bit is not used
as an invented spatial tie-on.

Observed build/turn/DLS statistics are scoped to entered BHA run start/end MD.
Optional recorded steering exposures support associative slide-fraction fits
and comparisons across run IDs; motor yield and maximum capability are not
inferred from surveys alone. Curvature-gain sensitivity remains an assumption.
Sampled geometric convergence and cumulative integration error are checked.
No global optimum, collision clearance or mechanical execution approval is claimed.

How to opens an isolated, clearly SIM-labelled animation of the actual ten-template
search. A late-start case retains the same target and 4°/30 m ceiling. No live
form, survey, BHA library or saved settings are changed. A slow red pulse marks
no feasible evaluated solution or at least 90% use of the effective DLS ceiling;
reduced-motion users get static red. Missing inputs are not labelled impossible.

77 unit tests passed, including 13 landing tests. Desktop/phone browser tests
covered hidden entry, typing/focus, both target types, exports, updated survey
response, explicit projection, dirty edits, scope/operator changes, completed
bore exclusion, animated tutorial isolation, red warnings and reduced motion.
The existing survey/pump/tally regression also passed. The actual unpublished
deploy passed Q/how-to/hard-warning checks plus all existing protected workspace
checks before promotion. All five changed runtime files independently matched
live SHA-256 hashes. Details: `drilling-tests/LANDING-PLANNER.md`.

## Joint-resolved landing instructions and progressive reservoir simulations

Deploy `6afe95540df588e5cef0730c`; rollback `6afe6caf49670fd2f5cea816`.
Runtime head `f7cbaf1617a8a084dbc9a508fa91bafe7070848a`.
Workflow https://github.com/tittothomasai-code/management/actions/runs/44471475691

Q now generates the actual trajectory at 6 m, 9 m, chosen nominal or measured
pipe boundaries. Each row specifies start/end MD, planned advance, dogleg over
the row, required DLS, start/end inclination/azimuth, required changes and full
pipe/partial-landing details. An anchored grid remains aligned as surveys move
forward. The explicit active-tally action reuses measured MD boundaries with
BHA included once; measured gaps are never filled by nominal values. Joint CSV
exports preserve full precision and flag feasibility. Selected rows mark their
point on the plots. DLS and dogleg are placed first for phone readers.

The paths use one constant-curvature minimum-curvature arc per instruction.
Interior endpoint tangents are fitted to the target while holding the MD grid
and final tangent fixed. Reconstructing rows reaches the requested N/E/TVD
within tolerance; it is not merely a table sampled from a high-level curve. A
same-scope prior continuation is re-aligned and revalidated as the tenth seed,
so rolling replanning can retain its own feasible remaining route. Source
surveys, already-drilled history and well plans remain unchanged. Required
geometry is not a promise of actual BHA response or an equipment command.

How to now has a nominal 500 m program with expected, early/shallower and
lower/deeper reservoir cases. Each executed joint creates a SIM survey and
triggers a new search with the drilled prefix fixed. The reservoir interpretation
changes at/after MD 260 m from TVD 300 to 280 or 320 m. A red **TARGET TVD IS NOW
LOWER** sign explains that a deeper reservoir has larger numeric TVD; the target
marker and reservoir line move. The early case lands at 500 m. The deeper case
stops when 500 m cannot meet the fixed target/ceiling; an explicit SIM-only
510 m program-change button can resume it. No ceiling or real program changes
automatically. Play, next-joint, pause, varied measured examples, acknowledgements
and reduced-motion updates are available. The tutorial reads/writes no live data
or saved settings.

85 unit tests passed, including instruction replay, exact per-joint dogleg/DLS,
partial joints, measured coverage, BHA/MD alignment, all four interval modes,
prefix immutability, both reservoir changes and the explicit deeper-program
revision. Desktop and phone browser tests passed the joint UI/CSV, active measured
tally, all progressive cases and red sign; the existing dashboard regression
also passed. Actual unpublished-site tests executed the 500 m replay, joint table
and warning, plus protected Ops/Tally/BHA/DD/EDM/menu checks before publication.
All eight changed runtime modules independently matched live SHA-256 hashes.
Details: `drilling-tests/LANDING-PLANNER.md`.

## Adaptive landing search with every evaluated joint schedule

Deploy `6afea4a0c85f6f7af5607edc`; rollback `6afe95540df588e5cef0730c`.
Runtime head `ab538477801adf3a60a3e3b17112beebd7780ce3`.
Workflow https://github.com/tittothomasai-code/management/actions/runs/44479600033

Q no longer highlights or stops at ten scenarios. Multistart exploration feeds
adaptive build/turn refinement of the actual joint-boundary tangents, fitting
each candidate to the landing target and angles. Analytical bounds can end a
simple case early; other searches refine until the documented model convergence
criteria or resolution floor. A time/evaluation budget pauses computation with
an exact resumable frontier, visibly distinct from convergence. Continue does
not restart the search or discard prior evaluations. This is a bounded numerical
search, not a claim that all continuous physical paths have been enumerated.

The full evaluated-case ledger includes every actual candidate, its generating
parameters, peak DLS, target miss, rejection reason and duplicate attribution.
Any case can reconstruct its original per-joint MD, advance, dogleg, DLS and
endpoint angles in a worker, even outside the retained comparison shortlist.
Replay steps through every evaluation. Cases without resolved geometry retain
their rejection rather than inventing instructions. Compact recipes retain the
ledger while full-path caches and the comparison shortlist remain bounded.

The isolated 500 m tutorial stores the search at every executed joint. Select
any prior drilling step, replay or inspect every evaluated alternative against
that step's fixed prefix/target, and export all search histories. Inspection
never substitutes an arbitrary alternative for the validated execution choice.
Normal, shallower and deeper cases share this implementation. Existing measured
pipe support, partial joints, scoped live surveys and read-only feed behaviour
remain intact.

89 unit tests passed. New tests check refinement beyond seed shapes, exact
pause/resume, complete outcome accounting, replay of every ledger case and
reachability proofs. Desktop and phone browser checks passed every-step tutorial
history/export/replay, non-retained inspections, budget continuation, the full
500 m normal/shallower programs and explicit deeper-program change, plus existing
survey/pump/tally regressions. The actual unpublished deploy passed desktop/phone Q/how-to/ledger checks and
all protected Ops/Tally/BHA/DD/EDM/menu checks before promotion. All seven changed
runtime files independently matched live SHA-256 hashes after publication.

## Rectangular spatial targets and animated bit crossings in the landing tutorial

Deploy `6afeae219bde381fbbfb6c77`; immediate rollback `6afeac78eee8c7fc5e7744d5`.
Runtime head `10858c765ab053157e3f0a33a8861ef54ade7ec1`.
Workflow https://github.com/tittothomasai-code/management/actions/runs/44484862528

How to now has a rotatable 3D view of the bit/BHA marker, the drilled prefix and
rectangular target planes. The bit advances on the same per-joint arcs as the
instructions. Amber targets turn green on an actual in-bounds forward crossing;
missed or planned-to-miss windows appear red. The opening camera keeps all target
faces visible. Drag, arrows, rotate, top, side and reset views work on desktop and
phone. The BHA marker is schematic and checks the bit centre, not body clearance.

The initial SIM reference path supplies three illustrative 24 × 24 m rectangles
near MD 120, 240 and 500 m. They remain fixed across replanning. Only the preset
landing window follows a declared reservoir TVD change. The editor supports up
to 12 required windows with local N/E/TVD centre, normal inclination/azimuth,
width and height, plus add/remove and target ordering. Applying edits explicitly
restarts the SIM; custom windows remain fixed and survive joint-length changes.
Editing pauses execution until application. No live data or form is changed.

All candidates are checked against the remaining ordered targets. Misses make
paths infeasible and contribute to refinement priority; execution refuses them.
The exact plane-distance equation along each minimum-curvature arc is split at
its analytic extrema before root finding, so crossings between endpoints are not
lost. Both in-plane dimensions and positive forward crossing speed are checked; tangent
touches, coplanar travel and reverse passages cannot count as a pass. Completed
targets remain visible in actual and historical views. Replay inputs copy target
geometry, preserving original evaluated outcomes across later edits. Exports
include all target definitions, crossing positions/MD/offsets and rejections.

95 unit tests passed, including six spatial-window tests: metre dimensions at
multiple orientations, validation, inclusive edges, reverse/order rejection,
same-side-endpoint curved crossings, tangent-touch rejection, lateral misses and exact reconstruction,
full 500 m gated execution and successful adaptive steering to an offset window.
Desktop and phone browser checks passed every green crossing, 3D rotation,
add/remove/edit, invalid dimensions, an unreachable target blocking play, existing
reservoir cases, joint instructions, full audit replay and unchanged live state.
A separate animated desktop/phone pass captured the bit just after the first
rectangle at MD 130 m. The actual unpublished deploy passed desktop/phone target-window and protected
Ops/Tally/BHA/DD/EDM/menu checks before promotion. All nine runtime modules
independently matched live SHA-256 hashes after publication.

## Sky Run — separate 3D landing game and deformable reservoir

Deploy `6afed111e9720ca5174624f4`; immediate rollback `6afeae219bde381fbbfb6c77`.
Game https://drilling.robotyx.systems/landing-game/index.html
Runtime head `1a5efe33559b43a738e0f25fed13981961bab397`.
Workflow https://github.com/tittothomasai-code/management/actions/runs/44507104603

`/landing-game/index.html` opens a dedicated WebGL game with an animated ring
corridor, moving chevrons, holographic target frames, reused detailed PDC geometry,
orbit/chase cameras and a labelled fallback. Q and its how-to link to the new page;
the existing joint-by-joint planner/tutorial and protected workspaces stay available.
No live feed, account, billing or plan is read or changed by the game.

Guide rings use 10 m, 30 m or uploaded measured tally spacing from a configurable
kickoff. Pinned targets are additional to this guide grid. Dragging a future ring
promotes it to a fixed target and realigns the corridor. N/E/TVD arrows, coordinates
and mouse/touch dragging operate in true 3D. Mid-flight replanning keeps the flown
prefix and current bit position/tangent. Cleared targets remain fixed. Tally mode
uses run-order lengths and optional first remaining length, adds no BHA offset,
and pauses at coverage. Switching to shorter coverage cannot rewind the bit.

The reservoir has curved roof/floor meshes, contours and faint absolute-TVD levels.
Two-finger surface mode changes depth, thickness and dip; numeric controls are also
available. Future landing targets track edits while flown history stays fixed.
The landing rectangle can be resized with white 3D corner handles or metre inputs.
Heading maps the entry gates; inclination follows the local bed gradient or a
manual value. The final tangent, all four rectangle corners, the approach within
the bed and a 60 m game runout are checked. The renderer and handles use the same
rectangle basis, verified at 15 orientations. Conflicts cannot count as successful
landings; flight stops before the first applicable floor/approach constraint.

112 unit tests passed locally, including 17 game tests for spacing, pinned targets,
fixed history, measured/partial pipes and coverage, roof/floor deformation, floor
entry between outside endpoints, corner fitting, heading/tangent mapping, manual
runout rejection and rollback. Desktop/phone WebGL tests passed mouse/touch target
and corner dragging, actual two-finger surface changes, tally upload/coverage,
full landing and floor stopping. The forced fallback and existing landing browser
regression passed. Source details/controls: `drilling/landing-game/README.md`.

This is a sampled cubic-Hermite game spline, separate from engineering landing
instructions or calibrated BHA response. Floor checks concern the game bit centre,
not full body clearance or survey uncertainty; the display bit is enlarged.
Course edits remain in the current tab. No external art, fonts or CDN assets are
used; existing local MIT notices and original bit geometry are retained.

The actual unpublished deploy passed the protected workspaces and the complete
new desktop/phone game checks, including real pointer/touch corner resizing and
two-finger surface deformation, before promotion. All 13 changed/new runtime
files independently matched live SHA-256 hashes after publication.

## Directional Drilling Simulation — editable contours and XYZ inspection

Deploy `6afee62ead136e1316f3f5c0`; immediate rollback `6afed111e9720ca5174624f4`.
Page https://drilling.robotyx.systems/directional-drilling/index.html
Runtime head `93cc50ea680ce46df7648041d2ea8fddc16b6921`.
Workflow https://github.com/tittothomasai-code/management/actions/runs/44520723281

The page, help, menus and canonical folder are now named Directional Drilling
Simulation. The old `/landing-game/index.html` entry redirects to the canonical
page. Its fallback link uses the host's canonical URL so automatic pretty-URL
rewriting does not change the verified static payload.

Reservoir controls offer rolling beds, a flat/tilted plane, dome, basin, saddle
and folded beds. Relief controls amplitude; N/E feature scales change contour
spacing. Roof/floor meshes, contour lines, analytic gradients, landing alignment
and floor guards share the same surface function. Two-finger depth/thickness/dip
controls remain available. Surface edits retain flown history and bit continuity.

The XYZ tool ray-picks the actual roof, floor, bit display, route or rings. Values
use local metres: X East, Y North, Z TVD, positive down. A cross marker identifies
the chosen point. Roof/floor picking refines mesh hits onto the analytic surface;
changing layer keeps the same East/North. Focus reservoir eases phone picking.
Empty sky never invents a coordinate. Numeric precision is not surveyed accuracy.
The labelled fallback keeps numeric target editing; surface probing requires 3D.

120 unit tests passed, including 25 focused simulation tests. Eight new cases
check all six surface gradients/thicknesses, genuinely different geometry,
validation/atomic rollback, fixed flown history, world-to-drilling conversion,
vertical/angled roof/floor rays and unresolved/out-of-bounds rays. Desktop
1920×1080 and phone 390×844 browser runs passed contour changes/scales, real XYZ
roof/floor taps, mouse/touch target and corner dragging, two-finger deformation,
tally coverage, fixed history, full landing, floor stopping, the old-link redirect
and fallback. The existing landing-planner desktop/phone regression passed.
Screenshots/results are in `drilling-tests/directional-evidence/`.

The actual unpublished deploy passed the protected workspaces and complete new
simulation browser checks before promotion. All 16 changed/new runtime files
independently matched live SHA-256 hashes after publication. The original site
inventory was preserved. The page stays a synthetic geometry simulation; the
joint-resolved engineering planner remains separate and available through Q.

## Main Ops — landing and drilling workspace, Settings and next-well selection

Deploy `6aff8149ef3a1cd4e10fc01f`; immediate rollback `6afee62ead136e1316f3f5c0`.
Dashboard https://drilling.robotyx.systems/ops
Runtime head `c4e9588279c22c9b6ae04805c10fd76b72f3cd1a`.
Workflow https://github.com/tittothomasai-code/management/actions/runs/44634915176

Main Ops now exposes Landing & drilling in navigation and a compact status card.
The clean workspace shows survey/target Inc/Azi, exact next-joint DLS/dogleg and
ending angles, a rotatable projection of the evaluated 3D survey/landing path,
and a collapsed complete joint schedule. Settings opens the existing planner for
target/tie-on, BHA response, measured/nominal joint lengths, limits, exports and
full search review. Closing Settings returns to the workspace. Q remains a
shortcut to the detailed planner. No solver or audit-ledger rebuild was needed.

Opening the workspace enables the existing survey/depth recalculation while its
dialog and Settings are closed. The status presentation suppresses obsolete
instructions on changed inputs, scope changes, an unfinished/failed search,
missing complete surveys, delayed/unsigned feed, unreported/invalid/derived or
off-bottom bit depth, completed bore, or hard/infeasible selected geometry.
Manual previews remain labelled drafts. Active survey guidance needs advancing
feed under 120 seconds old and reported bit depth within 0.5 m of hole depth.
The last-survey marker never pretends to be a measured current bit position.
The landing rectangle is a position tolerance or calculated pose, not geology.

Simulation lazily embeds the existing Directional Drilling Simulation, including
its synthetic contours and XYZ tools, without passing live data or settings.
Changing tabs removes the iframe and its rendering work. The active plan remains
unchanged. Detailed forms are absent from the default workspace.

Ops Settings now accepts a well name or UID with an Open well button. It refreshes
into the encoded well URL and a new app/data scope, preventing in-flight or stored
previous-well data from being relabelled as the next well. Existing credentials
are not persisted or added to the URL; the page asks for reconnection if needed.
No equipment command, WITSML write or automatic live well-plan update is issued.

130 unit tests passed, including ten new status/scope/next-well tests. New desktop
1920×1080 and phone 390×844 browser checks passed main entry, clean Settings return,
exact next joint, 3D rotation, closed-dialog recalculation, lazy isolated practice,
delayed/off-bottom/hard suppression, scope changes, next-well navigation, responsive
fit with both a populated plan and expanded joint table, and zero transport calls. The existing full planner/tutorial regression also
passed on desktop and phone. Screenshots and results are stored under
`drilling-tests/ops-landing-evidence/`; user steps are in LANDING-PLANNER.md.

The actual unpublished host passed the protected workspaces, the new Ops workspace,
Settings, embedded practice and Open well flow on desktop and phone before
promotion. All six changed/new runtime files independently matched live SHA-256
hashes after publication. Original site inventory was preserved.

## 20 November 2026: slide-correlated Ops Performance

Published source `112b6a470fc2b3970e2530ae4d5abc8178a539d7`, PR #29 plus the
empty-state source-label correction. Deploy `6b002ae2f09121ea2e3abff7`; immediate
rollback `6aff8149ef3a1cd4e10fc01f`. Restore that prior deploy in the existing site
Deploys screen if rollback is required.

Ops now has a separate Performance view. Actual survey intervals match recorded
slide and rotary phases at the same drilled MD. Inferred mode cannot establish
motor response, and mixed intervals need a reviewed signed rotary baseline.
Source, BHA run scope, interval counts and attributed slide metres stay visible.
The existing workbook and WITSML buffers are reused. No upstream writes, equipment
controls, auth, billing or permission changes. See OPS-PERFORMANCE.md.

147 unit tests passed. Desktop and phone synthetic checks passed depth matching,
rotary baseline, missing/inferred/conflicting evidence, scope changes, delayed
time-log replies, CSV and keyboard/mobile behaviour. The existing full survey,
tally, landing, EDM, BHA and 3D checks passed. Actual unpublished-host acceptance
passed before publication. All four public Ops/Performance runtime files then
independently matched the tested source SHA-256. Historical workbook correlation
was checked; no authenticated private live-feed session was available.

Workflow evidence: management/actions/runs/44725505030, artifact
`drilling-release-evidence`, including screenshots. The prior 624-file inventory
was preserved; candidate inventory has 632 files, with 523 paths reused untouched.

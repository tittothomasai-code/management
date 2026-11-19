# Hidden landing planner and isolated how-to

Open `https://drilling.robotyx.systems/ops`, focus the dashboard and press **Q**.
On a phone use **Settings → Advanced tools → Landing planner · Q**. A direct
link is `/ops?landing=1`. The ordinary dashboard navigation is unchanged.
Escape closes the popup and returns focus. Q in an input does not toggle it.

## Operator flow

1. **How to · simulation** opens a separate tutorial. It animates a 500 m program, executes one joint at a time and searches the
   remaining trajectory after every SIM survey. Expected, shallower and deeper
   reservoir cases use a fixed illustrative 12°/30 m ceiling. The tutorial reads no live context,
   makes no storage writes and cannot change the underlying live form. Its SIM
   label remains visible. Reduced-motion mode presents static evaluated results.
2. Use the latest complete active survey, or explicitly name a manual planning
   draft and enter all six tie-on values. No invented next-well location or sample
   coordinates populate the live form. A completed bore cannot supply live
   landing-response observations; select the next well/bore or use a manual draft.
3. If surveyed MD is behind reported hole MD, confirm the last-survey-tangent
   projection or enter a reviewed manual tie-on. A confirmed projection is labelled
   ASSUMED and is not added to the measured response data. Forward landing MD must
   be ahead of the already-drilled hole. No current bit position is invented.
4. Choose **landing MD + angles**, or **local N/E/TVD + angles**. Inclination and
   azimuth are always required. In position mode MD is optional; if entered it is
   also solved as a constraint. In MD mode terminal N/E/TVD are outputs, not a
   constrained landing position. All coordinates share the tie-on's local survey
   frame and TVD datum; no grid or TVDSS transformation is assumed.
5. Enter the planning DLS ceiling and tolerances. The initial 3°/30 m is a planning
   input, not a measured BHA capability. Optional BHA design selection reuses the
   existing saved BHA library, revision and minimum declared component DLS limit.
   These remain unverified design values and do not identify the actual run.
6. Choose 6 m, 9 m, nominal pipe length or measured lengths. The visible joint
   schedule gives start/end MD, actual planned advance, dogleg over the row,
   required DLS, start/end Inc/Azi and build/drop/turn changes. A stable anchor MD
   keeps the pipe grid aligned on later surveys. First remaining length applies
   only at the anchor. Final part-joint landing preserves the physical full length.
   Measured CSV is `joint,lengthM`; the explicit active-tally button reuses that
   bore's measured order and cumulative MD without adding BHA twice. Manual drafts
   cannot silently borrow an active bore's tally. Missing lengths are never filled
   with nominal values. Export the joint-instruction CSV for the selected path.

   Search landing solutions, inspect the two plots and select a row. Required peak
   DLS, build/turn curvature, landing MD/angles, position miss and DLS margin are
   displayed. Duplicate geometries and unsuccessful templates are identified.
   Only a feasible, distinct evaluated candidate can be suggested.
7. For observed BHA response, enter the actual run ID and its start MD. An optional
   end MD prevents later assemblies being attributed to an old run. Without a run
   ID the statistics are survey trends, not BHA-specific attribution. At least three
   suitable intervals are needed for attribution or response-based ranking.
8. Optional steering CSV has exact columns `fromMd,toMd,bhaId,slidePercent`.
   Intervals must not overlap for one run ID. Only whole, unambiguous survey
   intervals are matched. A slide-fraction fit requires four observations and at
   least 30 percentage points of exposure spread. Near-vertical turn fits are
   withheld. Recorded run comparisons use matched intervals for each run.
9. New surveys or confirmed projected depth changes recalculate automatically.
   Dirty inputs are retained and must be explicitly submitted. Changing the well,
   bore or signed-in identity clears results and loads that scope's settings.
   Settings and the last 20 recalculations stay on this device. JSON exports
   preserve source/assumption details; path CSV includes scenario feasibility,
   effective DLS limit and tie-on basis. No live well plan is replaced.

## Red warning

The popup pulses red at a slow 1.4-second cycle when a completed search finds no evaluated candidate meeting
the constraints, or when the best candidate requires at least 90% of the effective
DLS ceiling. The effective ceiling is the lower of the planning ceiling and the
explicitly selected design profile's declared component limit. The reason is
shown in text. Reduced-motion users receive a static red warning. Missing inputs
are input errors, not declarations that landing is impossible. An old warning is
cleared when inputs/scope change. Failure of these templates does not prove that
every conceivable trajectory is impossible.

## Adaptive search and the complete evaluated-case record

There is no ten-scenario quota. Initial shape seeds and 24 space-filling starts
feed adaptive joint-tangent refinement. Smooth build/turn perturbations at four
locations are refitted to the target on the actual joint grid. The next round
refines the best distinct feasible/least-violating geometry. Improvement uses the
exposed score, a 0.001 threshold, halved angular steps starting at 1.5°, and
convergence at two stable refinement levels below 0.1° or the 0.025° resolution
floor. An exact tangent-curvature or straight-line bound can stop earlier; a proof
case is recorded rather than inventing alternatives. This is convergence within
the explored model and resolution, never exhaustive enumeration of continuous
physical possibilities or a guaranteed global optimum.

Each compute pass has a visible time budget (default 1.2 seconds in Q, 3 seconds
in the tutorial). A 1,024-evaluation batch safeguard also pauses a pass. **Search
paused** is separate from convergence. **Continue search** retains every prior
result and resumes its exact queue and refinement state; increasing the budget
does not restart the search. Slow devices may need further passes. Unresolved
model geometry or missing measured joints is not a claim of impossibility.

The ledger includes **every actually evaluated candidate**, including rejected
and duplicate cases, its generating parameters, peak DLS, target miss and decision
reason. Paging/filtering changes only the display. **Inspect** reconstructs any
case's original joint schedule and plots in a separate worker, including cases
outside the retained comparison shortlist. Cases with no resolvable geometry show
their rejection instead of fictitious joint instructions. **Replay every
evaluation** steps through the whole ledger in evaluation order. Pause stops the
replay. Retained full paths and reconstruction caches are bounded; compact recipes
retain the rest. JSON exports include the complete ledger and replay inputs.

The how-to retains a separate search record at **every drilling joint**. Review
any earlier drilling-step search, inspect every alternative with that step's fixed
drilled prefix and target, or export all searches and executed rows. The moving
path review shows each actual case; progress counts come from the real planner.
Inspection does not substitute a rejected path for the validated execution choice.
Normal, early and deeper cases all use this same search and audit implementation.

## Geometry, response and limits

The implementation reuses the game's `minCurve`, `atMD` and point validation from
`bha-builder/shared/wp-autotrack-core.js`, and the existing BHA library reader.
MD/angle mode starts with timing/curvature shapes using short-arc tangent
interpolation (plus a build-before-turn profile), then explores and refines them. The constant-rate case is
checked against the analytical circular arc and minimum orientation DLS bound.

Position mode uses cubic endpoint-tangent templates only as initial guesses.
Gaussian quadrature/bracket searches seed the design; the final product is a
piecewise minimum-curvature path on the chosen joint boundaries. A damped,
finite-difference, minimum-norm correction of smooth interior tangent bases fits
the target N/E/TVD while preserving every boundary MD and the terminal tangent.
The numerical goal is 1 micrometre; acceptance is at most min(5 mm, 10% of the
entered position tolerance). This is computational precision, not a claim about
field measurement or achievable steering accuracy. Total MD is exactly the entered
landing MD when supplied. Dogleg and DLS are computed from each actual joint arc,
not averaged from a high-level curve. Row MD/inc/azi reconstruct the landing.

A same-scope prior continuation is an additional seed. It is re-aligned and
revalidated against the latest actual tie-on and revised target, never assumed
safe. This prevents a perfect execution losing its own valid remaining path at
the final joints. A different scope cannot supply this continuation. All consumed
pipe lengths remain in the anchor grid; a new partial first row has the correct
remaining length. Target-distance support remains 20 km and at most 4,000 control
intervals. Missing measured coverage is a data limitation, not a red geometric
impossibility claim.

The candidate score is peak DLS + 0.05×total dogleg + 0.0005×MD length, plus
0.1×absolute difference from observed median DLS when at least three intervals
exist. Lower is preferred among feasible distinct candidates. This is an exposed
heuristic refined over the generated set, not a global optimum guarantee or a motor controller.

Build, inclination-weighted turn and total DLS come from at most the latest 12
suitable measured survey intervals in the selected run. Intervals over 90 m and
duplicates/very short intervals are excluded from response statistics. Surveys
alone cannot isolate formation, toolface, slide fraction, operating settings or
maximum BHA yield. Recorded-exposure fits describe association. Assumed low/high
curvature gains (initially 0.8/1.2) show sensitivity, not calibrated confidence
limits. Older completed run response is not extrapolated as the current trend.

No collision, formation, torque/drag or execution clearance is issued here.
The source feed, surveys, tally, BHA records and other dashboard modules remain
read-only. The Q module calls no transport endpoints. All heavy calculations use
a cancellable worker; stale results are discarded across edits and scope changes.

## Verification

`npm test --prefix drilling-tests`: 95 passing tests, including 31 landing tests
for analytic geometry, wrap-around, duplicate holds, target/MD constraints,
infeasible DLS, sensitivity, scoped BHA intervals, recorded steering fits and
warning thresholds. Browser evidence is under `landing-evidence/`.

`PLAYWRIGHT_MODULE=playwright node drilling-tests/landing-browser.mjs` checks actual
Ops/landing source at 1920×1080 and 390×844 with local SIM transport only: hidden
entry, typing/focus, phone entry, adaptive search, budget pause/continuation, non-retained-case reconstruction,
all-step tutorial history/export/replay, target modes, exports, stale-result
protection, animated and isolated tutorial, hard case, red pulse/reduced motion,
survey/depth adaptation, explicit unsurveyed projection, dirty edits and scope
changes. It asserts no external requests or WITSML calls.

The existing survey/pumps/tally browser regression suite also passes. Release
acceptance exercises Q, manual SIM-input geometry, the isolated tutorial and red
warnings on the actual unpublished static deploy, alongside Ops/Tally/BHA/DD,
Plan-before-Drill and EDM checks, before any production promotion.

## Progressive 500 m reservoir simulation

The default SIM program lands at MD 500 m, local N 318.756 m / E 85.410 m,
TVD 300 m, Inc 90° / Azi 15°, with a fixed illustrative 12°/30 m ceiling.
Choose 6 m, 9 m, nominal 13 m or varied SIM measured lengths. Play or execute
one joint; pause takes effect after the current joint. Each executed arc creates
the next SIM survey, then all remaining candidate paths are recalculated.
The white drilled prefix is immutable. The next-joint table and moving marker
use the same row endpoints, not a separate illustration.

At the first joint boundary at/after MD 260 m the shallower case updates its
reservoir interpretation to TVD 280 m. The original 500 m program can still be
landed but requires a harder remaining trajectory. The deeper case updates to
TVD 320 m. Its red sign says **TARGET TVD IS NOW LOWER**, with the explicit
clarification that lower reservoir elevation means a larger numeric TVD. Old and
new target markers and a reservoir-depth line show the change. The update is a
training interpretation change, not a claim that a physical reservoir was
encountered at that MD.

The deeper case cannot satisfy the fixed 500 m target and ceiling from that
already-drilled prefix. It stops, remains red and executes no rejected joint.
An explicit **Try 510 m landing · SIM program change** action changes only the
SIM MD program; it retains the target and DLS ceiling. No automatic extension or
limit relaxation occurs. The updated model can then land at TVD 320 m. Target
changes can be acknowledged to stop their pulse without erasing the event.
Reduced-motion mode uses discrete updates instead of moving-joint animation.

Unit tests execute every row through 500 m for all four length modes, and verify
both reservoir changes, a blocked 500 m deeper program and an explicitly changed
510 m program. They reconstruct N/E/TVD/Inc/Azi from instructions and assert prefix
immutability. Desktop/phone browser checks execute the full normal and shallower
wells, the deeper preview, its red sign and its explicit 510 m continuation. They
also exercise measured CSV, active-tally/BHA alignment, partial rows, markers and
joint CSV exports. Tutorial execution still leaves the live form/storage unchanged.


## Rectangular spatial targets in the tutorial

Open **How to · simulation**. The rotatable **3D rectangular targets** view shows
the bit/BHA marker, the fixed drilled prefix and the selected remaining path.
Drag on the view or use Rotate, Top and Side buttons; focused arrow keys also
rotate it. Amber windows are ahead, green windows have actually been crossed
inside, and red outlines show missed or planned-to-miss windows. The moving bit
uses the same minimum-curvature arc and MD as the joint instructions.

Three illustrative 24 × 24 m windows are seeded from the initial validated SIM
reference path at approximately MD 120 m, MD 240 m and landing. They are then
frozen across replanning; candidate paths must pass them. This deliberately makes
the first demonstration achievable, rather than inventing surveyed geology. Only
the preset landing window follows the explicitly changed reservoir target TVD.
Custom windows stay fixed through reservoir interpretation changes.

Expand **Edit / add target rectangles** to enter local N/E/TVD centre coordinates,
width, height and normal inclination/azimuth. Width is lateral in the target plane;
height is the in-plane up/down dimension. These are true 3D planes, not axis-aligned
screen boxes. Add/remove windows and move their rows up/down to set crossing order.
Up to 12 required windows are supported; dimensions are 0.1–1,000 m. **Apply windows
· restart SIM** explicitly restarts the tutorial with those fixed targets. Editing
pauses execution until application; it cannot move an already-drilled prefix.
Custom windows survive joint-length changes. SIM edits never alter the live form,
feed, saved BHA or well plan.

Every candidate is checked against every remaining window. A forward crossing
must lie within both rectangle dimensions and follow the preceding target in MD.
The plane-distance equation on each constant-curvature joint arc is split at its
analytic extrema, then roots are bracketed: crossings between station endpoints
are detected even when both endpoints lie on the same side. Lateral misses cannot
pass solely because a side-view projection appears aligned. Edge crossings are
inclusive at 1 micrometre numerical tolerance. A tangential touch, coplanar arc or reverse passage
is not a forward crossing. Window violation contributes to refinement priority,
and any missed required window makes that candidate infeasible. Execution refuses
it. The search still makes no global feasibility guarantee.

The panel reports planned and actual crossing MD, with the full crossing position,
in-plane offsets and rejection in exported evaluated-case records. Completed
windows leave the remaining constraints but remain green in the 3D view and in
each historical search snapshot. All tutorial histories export their windows too.
The marker represents the bit centre and a schematic BHA tail: this feature does
not certify clearance of the full BHA body or account for positional uncertainty.

Six new unit tests cover oriented dimensions, validation, forward/reverse/edge and
out-of-order crossings, hidden curved-arc crossings, lateral misses, full gated
500 m execution, exact ledger reconstruction and solver adjustment for an offset
window. Desktop/phone browser checks verify all three green crossings at MD 500,
3D rotation, add/remove/edit and validation, an unreachable target blocking play,
and unchanged live settings. Unpublished-host acceptance checks the real 3D files
and window outcomes before release.


## Separate 3D Directional Drilling Simulation

Use **Directional drilling · 3D** in Q or its How to screen to open
`/directional-drilling/index.html`. This is a separate simulation page; the joint-by-joint planner
and existing tutorial remain available. It has animated ring guides at 10 m,
30 m or uploaded tally intervals, pinned 3D targets, orbit/chase cameras, faint
absolute-TVD grids and a contoured reservoir roof/floor. Mouse/touch dragging,
N/E/TVD arrows and coordinates reshape future targets while preserving flown
history. Two-finger shaping changes reservoir depth, thickness and dip.

Landing has a resizable sweet-zone rectangle and explicit entry heading. The
surface-following inclination comes from local bed dip; a manual inclination can
also be entered. Corner fitting, entry/approach containment and a 60 m game runout
are checked. Conflicting paths cannot count as a good landing and stop before
floor penetration. These are game centreline checks, not full BHA clearance,
calibrated response, or live well-plan changes. See `drilling/directional-drilling/README.md`
for controls, measurement semantics, limits and resources.

Reservoir shapes include rolling, flat/tilted, dome, basin, saddle and folded beds.
Relief and N/E feature scales change the real mesh and the shared analytic bed
gradient. XYZ picks geometry in local metres (X East, Y North, Z TVD down); choose
roof or floor at the same East/North and focus the reservoir for easier phone
picking. Empty sky has no invented coordinates. The old simulation URL redirects.


## Main Ops workspace

Open **Landing & drilling** in the main Ops navigation or **Open workspace** on
its compact card. Guidance shows the last complete survey, target Inc/Azi,
calculated next-joint dogleg and DLS, ending Inc/Azi, and a rotatable 3D projection
of the actual evaluated path. Open the collapsed joint-by-joint plan for all rows.
For a position target, the rectangle represents entered position tolerance; for an
MD target it marks the calculated landing pose. It never represents formation data.
No synthetic roof/floor is presented as measured geology.

**Settings** opens the existing full planner for target, tie-on, joint lengths,
BHA identity/response, DLS limits and search review. Search once, then close
Settings to return to the clean workspace. The existing planner worker and audit
ledger are reused. Q still opens the detailed planner as a shortcut. After the
workspace has been opened, new surveys/depth changes continue to invalidate and
recalculate its report with Settings and the workspace closed. Changed inputs,
calculation errors and unfinished searches suppress obsolete next-joint guidance.

The card is advisory. Active survey guidance additionally requires a signed-in
advancing feed under 120 seconds old and reported bit depth within 0.5 m of hole
depth. Stale, missing, invalid, derived or off-bottom readings pause next-joint
instructions; the evaluated plan can still be inspected. A manual tie-on stays a
labelled draft. Infeasible/hard paths suppress instructions and pulse red, with
reduced motion respected. Identity, well and bore changes clear the prior scope;
the reported completed bore cannot supply next-well guidance.

**Simulation** embeds the existing Directional Drilling Simulation on demand.
Its contours, target dragging and XYZ tool remain synthetic practice. It receives
no live data or planner settings. Leaving the tab removes the iframe and releases
its rendering work; returning to Guidance preserves the active plan.

To prepare the next well:

1. In Ops Settings enter its well name or UID and choose Open well. Reconnect
   if prompted, choose its wellbore and confirm the feed/survey scope.
2. Open Landing & drilling, then Settings.
3. Enter the landing target and reviewed limits; choose 6 m, 9 m, nominal or
   measured tally lengths and the correct BHA run.
4. Search landing solutions, review the full result, and close Settings.
5. Follow the advisory joint requirements and review recalculations with each
   survey. No rig command, live well-plan update or automatic steering is issued.

Verification adds ten status/next-well unit tests and desktop/phone browser checks
for the main entry, Settings return, exact next joint, 3D rotation, recalculation
with closed dialogs, isolated lazy simulation, delayed/off-bottom/hard suppression,
scope changes, responsive fit and zero transport calls. Screenshots are in
`drilling-tests/ops-landing-evidence/`; actual-host release acceptance also opens
this workspace and simulation on desktop and phone before publication.

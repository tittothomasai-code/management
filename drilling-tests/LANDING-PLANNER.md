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

   Compare ten scenarios, inspect the two plots and select a row. Required peak
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

The popup pulses red at a slow 1.4-second cycle when no evaluated candidate meets
the constraints, or when the best candidate requires at least 90% of the effective
DLS ceiling. The effective ceiling is the lower of the planning ceiling and the
explicitly selected design profile's declared component limit. The reason is
shown in text. Reduced-motion users receive a static red warning. Missing inputs
are input errors, not declarations that landing is impossible. An old warning is
cleared when inputs/scope change. Failure of these templates does not prove that
every conceivable trajectory is impossible.

## Geometry, response and limits

The implementation reuses the game's `minCurve`, `atMD` and point validation from
`bha-builder/shared/wp-autotrack-core.js`, and the existing BHA library reader.
MD/angle mode evaluates ten timing/curvature shapes using short-arc tangent
interpolation (plus a build-before-turn profile). The constant-rate case is
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

A same-scope prior continuation can replace the tenth seed. It is re-aligned and
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
heuristic over the generated set, not a global optimiser or a motor controller.

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

`npm test --prefix drilling-tests`: 85 passing tests, including 21 landing tests
for analytic geometry, wrap-around, duplicate holds, target/MD constraints,
infeasible DLS, sensitivity, scoped BHA intervals, recorded steering fits and
warning thresholds. Browser evidence is under `landing-evidence/`.

`PLAYWRIGHT_MODULE=playwright node drilling-tests/landing-browser.mjs` checks actual
Ops/landing source at 1920×1080 and 390×844 with local SIM transport only: hidden
entry, typing/focus, phone entry, ten paths, target modes, exports, stale-result
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

# Hidden landing planner and isolated how-to

Open `https://drilling.robotyx.systems/ops`, focus the dashboard and press **Q**.
On a phone use **Settings → Advanced tools → Landing planner · Q**. A direct
link is `/ops?landing=1`. The ordinary dashboard navigation is unchanged.
Escape closes the popup and returns focus. Q in an input does not toggle it.

## Operator flow

1. **How to · simulation** opens a separate tutorial. It animates the ten-template
   search against one fixed position and landing tangent, then offers a late-start
   example. Both use the same 4°/30 m ceiling. The tutorial reads no live context,
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
6. Compare ten scenarios, inspect the two plots and select a row. Required peak
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

Position mode evaluates ten cubic endpoint-tangent templates. Gaussian quadrature
calculates arc MD; a bounded bracket/bisection search fits optional target MD.
Curvature is computed from the cubic derivatives. Sampling refines through
240/480/960/1920 stations until the peak changes by at most max(0.002°/30 m, 0.5%),
individual minimum-curvature integration error is below 0.01 m and cumulative
integration error is at most min(0.05 m, 10% of position tolerance). Unresolved
geometry is not feasible. The supported target distance/MD increment is 20 km.
Duplicate geometry is compared at equal MD fractions, not parameter speed.

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

`npm test --prefix drilling-tests`: 77 passing tests, including 13 landing tests
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

# Ops motor Performance

Open **Ops → Performance**. The screen uses the active wellbore’s actual surveys,
existing WITSML buffers and matching run-sheet records. It never uses the game’s
simulated motor model. Existing connection credentials and read-only transport are
reused; this module adds no proxy, auth, billing, write or equipment-control API.

Each survey interval shows its MD span, slide/rotary/unknown metres, exact spatial
DLS, build, inclination-weighted turn, response attribution, and expandable mode
evidence. Phone tables become vertically stacked cards. Settings start collapsed.
Export intervals downloads a source-labelled CSV; no data leaves the device.

## What is attributed to sliding

- Correlate the **same spatial MD interval**, not survey receipt time or the joint
  being drilled when that survey arrives. A normal survey MD is already the
  downhole station’s borehole position; never add the BHA length to it.
- Recorded Slide/Rotate phases come from the existing scoped run-sheet reference,
  including device-imported references. Phase length and end MD define each span;
  unused tally inventory and the workbook’s sheet-end depth are not drilled footage.
- Reuse explicit WITSML mode channels where present. RPM-derived classification is
  labelled inferred and cannot establish motor response. Inference needs new hole
  advance, pumping, stable surface RPM and bounded sample gaps. Pressure >100 psi
  supports pumps-on only when flow is missing; a reported zero flow takes priority.
  Bit travel, trips, off-bottom movement and zero ROP are not new slide footage.
- A complete recorded slide-only survey interval reports its observed DLS. A mixed
  interval requires a reviewed rotary baseline (signed build and weighted turn,
  both explicitly entered, plus a review/source reference). Subtract rotary vector
  components by rotary footage, then divide the residual by slide footage.
  Never simply divide total DLS by slide fraction.
- Mixed results are labelled **baseline-adjusted estimates**. Withhold them for
  slide footage <1 m or <10%, unreliable near-vertical turn, or >10° interval
  dogleg. Unknown coverage, inferred mode, conflicting stations or modes, survey
  spans >90 m, and BHA boundary/mismatch also withhold attribution.
- These are survey-averaged net steering responses. Formation, changing toolface
  and elastic response are not isolated; the values do not establish motor power,
  torque, wear, maximum capability, or operational instructions.

## Settings for the next well

Choose the correct well in existing Ops Settings. Connect normally, then open
Performance. Assign the actual motor/BHA run ID and measured start/end MD in
Performance Settings. A blank end means an ongoing run. The bundled workbook can
supply a recorded run grouping, explicitly not a verified motor serial.

If the source lacks recorded mode, paste confirmed intervals with the header
`fromMd,toMd,mode,bhaId`, e.g. a synthetic row `100,112,slide,SIM-MOTOR-A`.
Include rotate spans to complete mixed survey intervals. Every row retains its
source. Overlapping contradictory records are not silently resolved. The optional
run override associates workbook phase spans entirely inside its window with that
actual BHA ID; other workbook spans retain their original grouping.

Ordinary hole/bit-MD telemetry needs no offset. Only use sensor-indexed MD when its
reference and sensor-to-bit distance are confirmed. The offset is applied once to
the depth-log index, never to survey stations or the bit-MD channel. Time-log hole
MD is already a physical depth and is not shifted.

Overrides are per exact well/wellbore identity and **this open tab only**, with no
server persistence. Export work before reloading. Changing well/bore resets the
visible settings; another well with identical display names does not inherit them.
Time-log reads reject late responses from a previous scope. No plan is changed.
The feed is labelled advancing only with authenticated, recent actual row advance;
historical workbooks and disconnected/paused data are labelled separately.

## Verification

- 147 unit/regression tests passed locally, including 17 new performance tests.
- Desktop 1920×1080 and phone 390×844 browser checks passed recorded/inferred
  distinctions, spatial matching, mixed baseline, CSV, survey refresh, wellbore
  scope, keyboard return and phone fit. Synthetic fixtures made zero transport or
  external calls. Existing Ops landing browser checks passed both sizes.
- Read-only analysis of the already-supplied DR101L/WB04B01 workbook found 102 actual
  stations, 101 intervals, and 152 recorded mode phases: 332.48 m slide and 934.59 m
  rotary within the surveyed span. Two intervals have complete recorded sliding;
  mixed intervals remain unassigned without a reviewed baseline. This is a partial
  historical record, not the final well tally or a private-feed validation.
- Release CI creates an inventory-preserving unpublished host, reruns unit/browser
  checks and actual-host acceptance before promotion. PR checks never publish.
  Artifacts include desktop/phone screenshots and release/rollback deploy IDs.
- An authenticated operator’s private live-feed session was not available in the
  build environment. Live attribution therefore still depends on the source
  providing mode evidence and an actual BHA assignment, as stated above.

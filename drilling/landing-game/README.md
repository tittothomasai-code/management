# Sky Run — Robotyx landing game

Open `/landing-game/` directly, or use **Sky Run · 3D game** from the Q landing
planner / its how-to. This is a separate, synthetic game page. It reads no account,
WITSML or live well data and writes no live plans. Everything stays in this tab.

## Play and shape the corridor

- Start from a configurable kickoff MD, N/E/TVD, inclination and azimuth.
- Choose 10 m or 30 m guide spacing, or upload `joint,lengthM` CSV in run order.
  Tally starts at kickoff, with an optional remaining first-pipe length. No BHA
  offset is added. The example tally is explicitly SIMULATED. Flight pauses at
  the end of supplied coverage; it never invents further lengths.
- Drag any future ring to make it a pinned target. Smooth guide rings realign
  through the targets. Pinned targets are additional to the uniform/measured
  guide grid, so dragging a target does not falsely label a new distance as 10 m.
- Orbit empty sky, pinch/scroll to zoom, use the N/E/TVD arrows, or enter exact
  target coordinates. Overview frames the course; Follow bit supplies a chase
  camera. Space pauses/resumes. Calm respects reduced-motion preferences.
- Moving future targets during flight preserves the sampled flown prefix and the
  bit's current position/tangent. Cleared targets stay fixed. Restart retains the
  edited course and resets it to kickoff.

## Reservoir and sweet zone

The final approach has curved roof and floor meshes, contour lines, translucent
sides and faint absolute-TVD levels. Open **Reservoir** to edit depth, thickness,
dip and contour. In **Shape with two fingers** mode, two-finger vertical motion
changes depth, pinch changes thickness and twist changes dip. Camera pinch works
normally when shape mode is off. Numeric controls also work with a mouse.

The landing follows the reservoir centre. Moving the landing ring horizontally
moves its reservoir; moving the entry ring maps the entry heading. Open Landing's
**Sweet zone & entry angle** controls to choose rectangle width/height, heading,
and either the local bed inclination or an explicit inclination. **Resize with
3D corners** frames the target and exposes white corner handles. Drag the corners
to make the rectangle smaller; numeric dimensions remain available. The height
is limited to 80% of the bed thickness as the surface narrows.

The game checks every sweet-zone corner against the roof/floor, maps the approach
gates to the heading, checks the final tangent, and previews 60 m beyond landing.
Surface-following mode continues along the contoured bed; manual entry uses its
stated tangent and is flagged when that runout leaves the reservoir. The approach
after the entry target must stay inside the bed. Flight stops before a detected
floor or approach conflict, and a bad zone cannot count as a successful landing.
Surface edits preserve flown history. An edited surface that conflicts with the
current bit is flagged rather than teleporting it.

The visual corridor uses spinning circular guides, holographic rectangular target
frames and moving chevrons, with a directional arrow and dashed runout at landing.
The sweet-zone plane is perpendicular to the selected entry tangent. In surface
mode its inclination comes from the local N/E bed gradient along the chosen
azimuth. The final spline tangent is constrained to that inclination and heading;
manual inclination is validated against the game approach and runout rather than
being labelled successful solely because it hits the target centre.

## Limits and resources

This is an interactive cubic-Hermite spline game, not the joint-resolved landing
planner and not a calibrated BHA controller. Model distance is integrated from
sampled curve points. Floor checks concern the game path / bit centre, not full
assembly clearance or survey uncertainty. The bit model is enlarged for gameplay.
Changing a surface after a completed landing requires a restart. Targets are bounded
to a ±5 km local frame; at most 40 pinned targets and 2,000 guide rings are allowed.

All environment geometry, cloud textures, corridor effects and reservoir surfaces
are authored in code. The detailed PDC bit reuses the existing original geometry
in `../bha-builder/geometry.js` and `pdc-bit.js`. Rendering and orbit controls reuse
the existing MIT-licensed local files in `../bha-builder/vendor/`; retain their
licence notices. No downloaded art, external fonts, CDN calls or logos are added.
A labelled interactive 2D fallback supports numeric editing if WebGL is unavailable.

## Verification and release

`sky-run.test.mjs`, `sky-reservoir.test.mjs` and `sky-landing.test.mjs` provide 17 tests covering
spacing, exact targets/tangents, immutable flight history, measured/partial pipe
lengths and coverage, complete flight, 3D surface changes, corner fitting, floor
entry between endpoints, entry heading, manual runout rejection and rollback.
`sky-run-browser.mjs` tests real WebGL at 1920×1080 / 390×844, mouse/touch target and
corner dragging, two-finger surface deformation, tally upload, floor stopping,
full landing and the forced fallback. It can run against an unpublished host via
`SKY_PREVIEW_URL`. Screenshots/results are under `drilling-tests/sky-evidence/`.
The existing release workflow preserves the full site inventory, runs all protected
workspace checks and the new game checks on the actual preview before promotion.

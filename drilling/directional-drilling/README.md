# Directional Drilling Simulation — Robotyx 3D simulation

Open `/directional-drilling/` directly, or use **Directional drilling · 3D** from the Q landing
planner / its how-to. This is a separate, synthetic simulation page. It reads no account,
WITSML or live well data and writes no live plans. Everything stays in this tab.

## Run and shape the corridor

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

The simulation checks every sweet-zone corner against the roof/floor, maps the approach
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
manual inclination is validated against the simulation approach and runout rather than
being labelled successful solely because it hits the target centre.

## Limits and resources

This is an interactive cubic-Hermite spline simulation, not the joint-resolved landing
planner and not a calibrated BHA controller. Model distance is integrated from
sampled curve points. Floor checks concern the simulation path / bit centre, not full
assembly clearance or survey uncertainty. The bit model is enlarged for display.
Changing a surface after a completed landing requires a restart. Targets are bounded
to a ±5 km local frame; at most 40 pinned targets and 2,000 guide rings are allowed.

All environment geometry, cloud textures, corridor effects and reservoir surfaces
are authored in code. The detailed PDC bit reuses the existing original geometry
in `../bha-builder/geometry.js` and `pdc-bit.js`. Rendering and orbit controls reuse
the existing MIT-licensed local files in `../bha-builder/vendor/`; retain their
licence notices. No downloaded art, external fonts, CDN calls or logos are added.
A labelled interactive 2D fallback supports numeric editing if WebGL is unavailable.

## Verification and release

`directional-simulation.test.mjs`, `directional-reservoir.test.mjs`,
`directional-landing.test.mjs` and `directional-surface-probe.test.mjs` provide 25 tests covering
spacing, exact targets/tangents, immutable flight history, measured/partial pipe
lengths and coverage, complete flight, 3D surface changes, corner fitting, floor
entry between endpoints, entry heading, manual runout rejection, rollback, all six analytic surface gradients,
shape validation, world/drilling coordinate conversion, and exact vertical/angled
roof/floor picks. The complete regression suite contains 120 passing unit tests.
`directional-simulation-browser.mjs` tests real WebGL at 1920×1080 / 390×844, mouse/touch target and
corner dragging, two-finger surface deformation, tally upload, floor stopping,
full landing, contour presets and feature scales, XYZ roof/floor picks, the old-link
redirect and the forced fallback. It can run against an unpublished host via
`DIRECTIONAL_PREVIEW_URL`. Screenshots/results are under `drilling-tests/directional-evidence/`.
The existing release workflow preserves the full site inventory, runs all protected
workspace checks and the new simulation checks on the actual preview before promotion.


## Surface shapes and XYZ inspection

The page is named **Directional Drilling Simulation** and is available at
`/directional-drilling/index.html`. The previous `/landing-game/index.html` link
redirects here. Use Reservoir → Surface shape for rolling beds, flat/tilted plane,
dome, basin, saddle and folded beds. Relief changes amplitude; N/E scales change
feature size. The actual 3D meshes, contour lines, bed gradients, landing alignment
and floor checks all use the same surface model.

Click/tap a roof or floor point to inspect it, or activate **XYZ** to pick rings,
the bit display or route without dragging targets. Choose **Roof** or **Floor**
for a specific layer and **Focus reservoir** to make picking easier. The marker
pins the chosen point. Changing the picked layer reports the other surface at
the same East/North. A sky ray without geometry never invents a position.

Coordinates are local drilling metres: **X = East, Y = North, Z = TVD**, with depth
positive downward. Renderer axes/display elevation are converted, not exposed.
Roof/floor hits are refined onto the analytic surface rather than reporting a
coarse triangle approximation. Numeric precision is not surveyed field accuracy.

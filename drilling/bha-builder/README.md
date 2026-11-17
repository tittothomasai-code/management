# BHA builder for the drilling game

Version 1.0.2. This module opens inside the existing game, from Tools → BHA builder.
It provides a 3D component library and an editable bit-to-top report table.
The supplied example is SIMULATED. It contains no real tool serials or well records.

## Use

1. Select **Load example**, or add a bit from **Component library**.
2. Add components with **+**, or drag a library card onto a table row. Dropping on
   the table background appends the tool. Dropping on a row inserts before it.
3. Drag a row handle to reorder. On a phone, drag the same handle with a finger.
   The arrow buttons provide another way to change order. Item 1 stays the bit.
4. Enter description, serial, RIH hours, OD, ID, uphole/downhole connections,
   length and make-up torque. Cumulative length updates from bit to drill string.
5. Select a row to see its surface detail. Use **UH detail**, **DH detail**,
   **Selected tool**, **Separate tools** and **Cutaway** to inspect it.
6. Open **Well, run, bit and motor details** to enter the report header and details.
7. Enter a BHA name. Select **Save version**. Use the saved list and **Load** to
   resume it later. Export JSON to move the complete report to another device.
8. Select **Export table** for CSV. Select **Report / PDF** to open the printable
   report. Use the browser's Print / save as PDF action.
9. Select **Back to game**, or press Escape. The draft remains in memory until the
   page reloads. Saved versions remain in browser storage.

Geometry dimensions are metres. The table uses inches for OD and ID, metres for
length and hours for run time. Decimal and fractional diameters are accepted,
including `6 1/8` and `6⅛`. Optional report values remain blank when no value is entered. Zero is retained.
OD, ID, length and declared screening values require valid numbers. These values
drive the model; arbitrary text such as N/A is not a geometric dimension.
Torque uses N·m or lbf·ft. Changing the torque unit converts existing numeric row
values. The unit is shown in the torque column headings and exported report.

**True-scale assembly** and close-ups use physical proportions. A complete BHA can
be very thin in a full-string view. **Readable assembly** is an explicit display-only
mode: diameter is shown at 20×. The bit is scaled uniformly to preserve its aspect
ratio; other tool lengths stay at true scale. The displayed tally values remain physical.
The mode is labelled on screen. Camera close-ups do not resize individual parts.

## Existing work reused

- The existing `BhaLibrary` and `robotyx.demo.bha-library.v1` storage key.
- Existing bit-first, 16-component, dimensional and immutable-version validation.
- Existing report field names and bit-to-top cumulative-length convention.
- Existing game scene, camera, controls, canvas and frame hook.

`shared/` is an exact copy of the existing Spatial Studio library and its pure
geometry dependencies. The build checks the copies against the original files.
No second saved BHA library, backend or account store is introduced.

The new UI adds drag ordering, report data, detailed geometry and a game adapter.
It does not replace the existing native BHA, planner or drilling physics state.
Saved library versions remain unverified drafts. No proposal is applied to the rig.

## Build and game integration

```sh
npm run build:bha-builder
python3 -m http.server 8080 --directory dist-bha-builder
```

The static preview opens the same builder without the surrounding game. Its Back
button returns to the assembly view. The integrated game button returns to the rig.

Copy the built folder to `bha-builder/` beside the game index. Keep the existing
Three.js import map. Add these tags before the game's Home/Escape handler:

```html
<script src="./bha-builder/guard.js"></script>
<script type="module" src="./bha-builder/boot.js"></script>
```

The adapter adds a Tools button and BHA buttons in the Directional Drilling cabin
and engineering Operations dashboard. For the separate Ops and Well Plan pages,
add `<script type="module" src="./bha-builder/context-launcher.js"></script>`
before `</body>`. Those pages open the same editor in a local embedded panel.
Back to workspace returns to the unchanged page and retains the draft until reload.
All entry points use the same origin-local saved library.

The adapter adds a Tools button. No new global shortcut replaces an existing key.
Escape restores camera position, rotation, projection, environment, controls, scene
visibility and the game UI. The builder uses the original renderer and canvas.
Opening it from the Field view first returns to the rig view.

No intro, start-menu, ops, planner, scanner, geosteer or existing BHA module is edited.
The full game source is maintained outside this repository. Integration requires
those two host script tags and the host's usual regression checks.

## Assets and scope

The 32 original tool profiles cover PDC, roller-cone and core bits; near-bit and
orienting subs; mud motor and RSS; float, gap, crossover, safety, shock and fishing
subs; MWD and probe; gamma, resistivity, density and sonic tools; straight/spiral
stabilizers, reamer, hole opener; nonmagnetic, pony and drill collars; HWDP, drill
pipe, core barrel and catcher ring. They are representative, not a supplier catalog.

`geometry.js` generates the dimension-driven detailed models. Editable dimensions
therefore change the model without a remote request. High-detail connections have
helical threads and open bores. Tool-specific parts include cutters, nozzles,
blades, sensor bands, mandrels, motor rotor/stator, shaft and bearing pack.

`assets/` also supplies one meshopt-compressed GLB per profile, with LOD0/1/2,
PBR maps, metre dimensions and named parts. Internal parts carry `internal: true`
metadata and should start hidden in a GLB consumer. The game renderer uses the
same procedural source so edited dimensions remain parametric. It does not fetch
the entire GLB bank to open the editor. Rebuild the bank with `npm run assets:bha-builder`.

See `RESOURCES.md` and `asset-manifest.json` for sources, licences and triangle counts.

## Limits

Browser storage is origin-local, not an account-wide register. The shared library
allows 16 components per BHA and 100 saved assemblies. JSON import is limited to
2 MiB. Storage failure and stale versions produce errors. Export JSON for transfer.

The example dimensions and detailed features are schematic. They are not certified
CAD or a manufacturer drawing. The tool list is not exhaustive. Connection strings
do not validate thread compatibility. Torque values and tool ratings are entered
by the user; the builder does not approve them. Accessories are not automatically
nested or excluded from the inline tally. Confirm the physical string arrangement.

Existing declared screening values remain available under **Details**. They are
not a full surveyed-passage, hydraulics, torque/drag, fatigue or BHA dynamics analysis.
No live equipment, network API, credentials, billing or database change is supplied.
Static module and image requests stay on the local origin.

## PDC crown revision (1.0.2)

The PDC profile now uses a deep crown, five swept blades, 50 raked cutter faces,
separate gauge pads and wear buttons, five recessed open nozzles, wrench flats and
a threaded pin with an inlet. Nozzle holes pass through the crown mesh to their
recessed throats. `pdc-bit.js` is the original parametric source. The cutting face
stays at the downhole end. Bit inspection views look toward that face, so the
shank does not hide the crown. The new example bit is 0.300 m long. The extra 0.120 m extends the body and
threaded shank; the crown, cutters, gauge pads and nozzles retain their size.
Length remains editable. Existing saved reports retain their entered dimensions.

The shape uses the supplied diagram as a visual reference. It remains schematic;
no manufacturer dimensions or working ratings are inferred. The other 31 tool
profiles and the report data model are unchanged.

Rebuild this GLB only with `node scripts/build-bha-assets.mjs --only pdc-bit`.

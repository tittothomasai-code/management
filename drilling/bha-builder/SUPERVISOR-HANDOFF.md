# In-game BHA builder handoff

Source: tittothomasai-code/the-dome, branch `build/field-pumps-site`, PR #824.
Release head: 3ee30fcfa88a2f365ee196a5fe1066e7251a3c97.
The release zip resolves this value and includes `HEAD.txt`.
Review only. Do not merge or deploy.

## What is supplied

A static BHA builder module for the existing drilling game, not a separate management
application. It has a Tools entry, detailed parametric 3D tools, drag-and-drop ordering,
an editable report table and saved browser-local versions.

- 32 original schematic tool profiles and one compressed GLB per profile.
- LOD0/1/2, metre-scale dimensions, PBR maps, open bores and helical connections.
  Peak triangles per tool: 53,051 / 8,484 / 1,656. The full GLB bank is 16.0 MB.
- Motor rotor/stator, shaft and bearing-pack cutaway; bit cutters/nozzles; MWD/LWD
  sensors; stabilizer blades; jar mandrels; collars and pipe tool joints.
- Desktop library-to-table and row drag ordering. Phone touch row ordering and arrow controls.
- Item, tool, description, serial, RIH hours, OD/ID, UH/DH connection, length,
  cumulative length and UH/DH torque. Torque headings show the selected unit.
- Well/run header, bit and motor details. Unknown optional report values remain blank.
- Shared saved BHA library with immutable versions, stale-write protection, JSON,
  CSV and a printable report that can be saved as PDF through the browser.
- True physical proportions for close-ups and true-scale assembly. The optional
  readable assembly shows all diameters at 20× and scales the bit uniformly to
  preserve its aspect ratio. The schematic display is labelled.
  Data values remain at actual entered dimensions. The readable string is horizontal.

No supplier names, logos or real tool serials were copied from the supplied report.
The reference informed the report columns and bit-to-top tally convention.

## Existing work reused

`BhaLibrary`, its existing storage key, bit-first validation and immutable version
behaviour come from the existing Spatial Studio BHA builder. `shared/` is checked
byte-for-byte against those sources during the build. The module uses the original
game scene, camera, canvas, controls and animation hook. No native rig/BHA, Field,
planner, intro or menu source was edited.

The field-world and field-pumps modules remain available. This package adds a
separate Tools item. If Field is open, entering BHA builder first returns to the rig.

## Integrate into the game

1. Run `npm run build:bha-builder`.
2. Copy `dist-bha-builder/` beside the game index as `bha-builder/`.
3. Keep the existing Three.js import map. Add these after the import map and before Home/Escape handlers:

```html
<script src="./bha-builder/guard.js"></script>
<script type="module" src="./bha-builder/boot.js"></script>
```

4. Open Tools → BHA builder. Test the example, mouse drag, phone touch reorder,
   dimension changes, save/reload and exports.
5. Close it with Escape. Confirm rig camera, projection, lighting environment,
   controls, UI and existing module state return correctly.
6. Run the full original game regression checks on the integrated host before release.

The standalone zip uses the same view code and provides an easy review preview.
Its Back to game button returns to its assembly view because no rig is bundled.
The module does not replace the game or its existing BHA physics.

## Tests and evidence

Run:

```sh
node --test src/bha-game-builder.test.mjs
npm run build:bha-builder
node scripts/bha-builder-acceptance.mjs
node scripts/bha-builder-host-acceptance.mjs
ROBOTYX_CHROMIUM_PATH=/usr/bin/chromium npm run build
```

Eight focused tests cover all profiles and GLBs, real geometry envelopes, dimensional
validation, fractions, row identity, length tally, unit conversion, shared library
versions, CSV formula protection and escaped report output.

Ten browser checks cover desktop and phone ordering, editable dimensions, blocking
invalid edits, detailed views, full report save/reload and exports. Nine read-only
public-host checks cover Tools, Escape, camera/projection/environment and UI restore,
and reuse of the existing renderer. No live files are changed by the test harness.

The root build passes with 2,768 passed, 3 skipped and no failures. Evidence, screenshots
and recorded test output are supplied with the zip. Hardware rendering performance
remains a target-device acceptance item; the test renderer uses software WebGL.

## Boundaries

All profiles and the sample report are schematic and unverified. No connection
compatibility, manufacturer ratings, torque limits, tool life, safe operating
configuration or engineering approval is inferred. Inline accessories are not
nested automatically. Check their physical placement and tally treatment.

The existing library permits 16 components and 100 saved assemblies. Storage is
local to the browser/origin. JSON import is limited to 2 MiB. Saving a changed BHA
name creates a new library record; saving the same name appends a version. No
shared account persistence is claimed. Export JSON to move a report to another device.

Edits do not apply to the rig's active BHA or physics state. Integration with an
account-wide tool register must use the existing authenticated tenant-scoped store
and audit/version policies. This change adds no backend, live data, permissions,
billing, migrations or credential handling. All module resources are relative and
local. The game renderer generates parametric geometry instead of downloading the
whole GLB library. The GLBs are supplied for reuse and interchange.

Rollback removes the two script tags and the module folder. Existing game files,
Field modules and browser library records remain unchanged.

## PDC reference revision (1.0.1)

The PDC bit now has a deep crown with five continuous swept blades, 50 angled
cutter faces, separate gauge pads and wear buttons, five recessed nozzle sleeves,
wrench flats and a threaded inlet. Nozzle openings pass through the crown surface.
A ray-picking test verifies that the sleeve reaches its throat without the crown
blocking it. Bit inspection cameras now look toward the cutting face.

The supplied user diagram informed the silhouette and part layout. The mesh is
original geometry, not a copied photograph or certified tool model. OD, length,
assembly order and entered report values remain unchanged. The other tool meshes
were not regenerated. Updated close-up renders are in `evidence/pdc-update/`.

## Longer bit revision (1.0.2)

The new example uses an editable 0.300 m PDC bit. The extra 0.120 m extends
the body by 0.072 m and shank by 0.048 m. Crown, cutters, gauge pads and
nozzles retain their size. The physical table tally includes the longer bit.
Existing saved reports keep their entered dimensions. Readable mode preserves
the bit aspect ratio and labels its schematic scale; true-scale views restore
physical proportions. A regression test checks the extension and tally.

## Ops and Directional Drilling access

The same builder opens from Tools, the Directional Drilling cabin header and the
engineering Operations header. The separate Ops and Well Plan pages load
`context-launcher.js`; they open a local embedded editor. Returning restores the
workspace without navigation or data changes. Its hidden editor retains the draft
and stops rendering. Every entry uses the existing origin-local library.
No plan or live steering command is applied.

The context browser checks cover Ops and Directional Drilling at 1920×1080 and
390×844, shared saved-report loading, workspace return and Plan-before-Drill
menu order. Run with `BHA_GAME_ROOT=/path/to/drilling node
scripts/bha-builder-context-acceptance.mjs`. Screenshots are in `evidence/`.
Late-created native UI is hidden while the builder is active and restored on exit.

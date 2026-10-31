# Rig Builder — Pass 3 single-unit parts

Eight independent assets, each supplied in three Draco-compressed GLB LODs. Every file uses metres, Y-up and a +Z front. The root and the empty `attach_base` sit at the bottom centre of the canonical footprint. Attachment transforms and semantic paths stay fixed across LOD changes.

The source extends the original `land_1500_ac_double_detailed` pass 2 engine. It retains its oxide-red, muted ivory, blue-grey steel and safety-yellow material family, with rebuilt single-unit layouts and embedded normal maps, material cavity AO and ray-baked contact AO.

## Package

- `glb/`: 24 runtime GLBs, named `<id>_lodH.glb`, `<id>_lodM.glb` and `<id>_lodL.glb`.
- `manifest.json`: specs, measured bytes and decoded triangles, bounds, anchor transforms and node-path/BOM metadata.
- `screenshots/`: day and night renders of every High GLB, opposite-side views, Medium/Low inspection views and overview sheets.
- `source/`: rebuild scripts, configuration, original texture generators, eight uncompressed High master GLBs, the local inspection viewer, supplied A reference and QA evidence. This folder does not ship with the runtime bundle.
- `SHA256SUMS`: file integrity hashes.

## Part specifications

| Part | Representative specification |
| --- | --- |
| genset_single | 1,300 kW prime electrical class; diesel V12 |
| mud_tank_single | 450 bbl / 71.54 m³ working capacity; two 11 kW agitators |
| mud_pump_single | 1,600 hp triplex; 7,500 psi maximum; 1,193 kW AC motor |
| frac_pump_truck_single | 2,500 hhp hydraulic output class; 15,000 psi; 3,000 bhp diesel; tri-axle trailer |
| offshore_derrick | 51.816 m / 170 ft structural height; 1,500,000 lbf static hook-load class |
| substructure_drill_floor | 9 m floor; 500,000 lbf setback and 1,000,000 lbf rotary static classes |
| offshore_drill_floor | 14 × 14 m deck; 3.5 m deep box girders; 12.2 × 12.2 m offshore derrick pattern |
| substructure_drill_floor_A | 9 m floor; Showroom A paint; measured nominal 9.0 × 9.0 m mast pattern |

These are generic visual assets rather than manufacturer CAD or a certified equipment design. Maximum pump pressure and flow are not simultaneous ratings. The floor's two load classes are independent, not a combined-load envelope. Tank working capacity is separate from external shell volume.

The frac asset is one unhitched semi-trailer on deployed landing legs, with its kingpin facing +Z. It contains one prime mover, transmission and quintuplex pump, three axles, twelve tyres, manifolds, controls, service access and lights. No tractor or frac spread is included.

The offshore asset contains only the derrick structure and its attached platforms, ladders, guide rails, cap frame and lights. Crown machinery, top drive, drill floor and other rig equipment are excluded.

## Measured LOD budgets

Values are **decoded triangles / decimal kB**. Budgets: H ≤60,000 tris / 3,000,000 B; M ≤20,000 tris / 1,500,000 B; L ≤6,000 tris / 500,000 B.

| Part | High (tris / kB) | Medium (tris / kB) | Low (tris / kB) |
| --- | ---: | ---: | ---: |
| genset_single | 14,842 / 446.6 | 6,014 / 287.3 | 2,454 / 139.0 |
| mud_tank_single | 16,166 / 437.6 | 7,618 / 290.5 | 3,036 / 147.5 |
| mud_pump_single | 13,660 / 432.7 | 6,588 / 286.7 | 1,896 / 134.9 |
| frac_pump_truck_single | 36,492 / 655.4 | 11,008 / 383.4 | 5,086 / 212.7 |
| offshore_derrick | 48,340 / 546.1 | 10,292 / 302.4 | 4,052 / 156.8 |
| substructure_drill_floor | 21,104 / 505.7 | 8,692 / 325.9 | 4,588 / 183.9 |
| offshore_drill_floor | 17,470 / 497.0 | 6,174 / 339.8 | 3,244 / 191.7 |
| substructure_drill_floor_A | 21,104 / 517.2 | 8,692 / 344.7 | 4,588 / 191.8 |

High has bevels, fasteners, full structural profiles, cooling fins, grating and machinery fittings. Medium reduces segments and small fittings. Low keeps principal machinery, structural silhouettes, access routes and datums. Tiny fittings can disappear within the unchanged canonical footprint; each LOD's AABB records its visible bounds.

## Coordinates and attachment nodes

The footprint includes fixed stairs, rails, V-door and other protruding fittings, so its centre can differ from the shell or well centre. Use the supplied anchor. `sourceToOriginOffset` records the translation from the construction datum to the GLB datum.

Every GLB has a named root (`<id>`) and a leaf empty `attach_base` at `[0,0,0]`. Additional datums:

| Part | Empty node | Local position, m (X, Y, Z) |
| --- | --- | --- |
| offshore_derrick | attach_top | -0.10525, 51.81600, 0.00000 |
| offshore_derrick | attach_wellcentre | -0.10525, 0.00000, 0.00000 |
| substructure_drill_floor | attach_top | 1.50000, 9.00000, -0.62578 |
| substructure_drill_floor | attach_wellcentre | 1.50000, 9.00000, -0.62578 |
| substructure_drill_floor | attach_vdoor | 1.50000, 9.00000, 5.87422 |
| offshore_drill_floor | attach_wellcentre | 0.75750, 3.87000, -2.99850 |
| offshore_drill_floor | attach_top | 0.75750, 3.87000, -2.99850 |
| offshore_drill_floor | attach_vdoor | 0.75750, 3.72500, 4.55150 |
| substructure_drill_floor_A | attach_top | 1.50000, 9.00000, -0.62578 |
| substructure_drill_floor_A | attach_wellcentre | 1.50000, 9.00000, -0.62578 |
| substructure_drill_floor_A | attach_vdoor | 1.50000, 9.00000, 5.87422 |

The derrick also has four `attach_foot_*` nodes. The floor has four `attach_mast_foot_*` nodes. Full transforms and roles are in `part.anchors`. Empty nodes have identity rotation and scale. The well-centre datum marks the floor surface over a continuous open bore.

The offshore derrick mates with `offshore_drill_floor` on a 12.2 × 12.2 m pattern. Align the two `attach_wellcentre` nodes; each tower `attach_foot_LB/LF/RB/RF` then meets the floor's `attach_derrick_foot_LB/LF/RB/RF`. All nine floor/tower LOD combinations are tested. The original land floor retains its 9.6 × 9.6 m pattern; the A variant uses the source's nominal 9.0 × 9.0 m pattern.

The offshore deck is 14 × 14 m; its complete envelope is larger because the pipe ramp and stairs are included. It has hollow 3.5 m deep box girders, rotary, setback, four bearing pedestals, V-door, inclined pipe catwalk, stairs, rails and a complete doghouse entrance. It contains no hull or support legs. `attach_top` and `attach_wellcentre` share the rotary surface datum; the four receiving feet are coplanar with it.

The original derrick root has an X offset relative to its actual well datum: its foot X values are about −6.205253 / +5.994747 m and its well datum X is −0.105253 m. These are root-local values; foot offsets from the well datum are ±6.1 m. The new floor preserves that exact interface before bottom-centering its own complete footprint.

## Load, select and snap

Use a glTF 2.0 loader with `KHR_draco_mesh_compression` support. Three.js r160.1 was used for creation and browser verification. All PNG/JPEG maps are embedded. No KTX2 or Meshopt runtime decoder is needed.

```js
const draco = new DRACOLoader().setDecoderPath('/draco/');
const loader = new GLTFLoader().setDRACOLoader(draco);
const { scene } = await loader.loadAsync('/glb/genset_single_lodH.glb');
world.add(scene);
const base = scene.getObjectByName('attach_base');
const engine = scene.getObjectByName('engine');
```

Copy the Draco decoder files from `three/examples/jsm/libs/draco/gltf/` to the configured decoder URL. Selectable groups carry `userData.selectable`, `userData.componentPath` and `userData.bomId`. Surface meshes carry the owning BOM ID. Walk from a picked surface to its nearest selectable ancestor.

`part.nodes["genset_single/engine"]` gives the BOM ID, display name and specs directly. `part.nodeToBom` retains the compact pass 2-style path-to-ID map. `components` is the ordered metadata list. Each LOD also has a `nodeToBom` map.

`source/snap-example.mjs` exports `snapPart(childRoot, childAnchor, targetAnchor)`. It aligns anchor world transforms with rotated or uniformly scaled parents. Stack a mast's `attach_base` or centre datum on a receiving `attach_top` / `attach_wellcentre`, then use the matching mounting pattern.

## PBR and night lights

Every material has baseColor, metallicRoughness, normal and AO maps. MetallicRoughness and AO share ORM maps (R cavity AO, G roughness, B metalness multiplier). Material factors distinguish paint, rubber, steel and machined surfaces. Diamond-plate normals are separate from paint grain. Explicit tangents keep normal maps consistent across engines.

Ray-baked contact occlusion is in `COLOR_0`. Preserve vertex colours on import or optimisation. High uses a 2,048 px decal atlas and 1,024 px material maps. Medium uses a 1,024 px atlas and 512 px maps. Low uses a 512 px atlas and 256 px maps.

Fixture groups use `light_*` names. Work-light lenses use material `light`; obstruction and trailer-tail lenses use `red_light`. Set their emissive intensity to zero by day and restore it at night. The viewer adds point-light spill for previews; GLBs contain no scene lights or cameras. The host supplies the environment.

## Rebuild and inspect

Use Node.js 22+ and Python 3. From `source/`:

```sh
npm ci
python3 -m pip install -r requirements.txt
npm run textures
npm run generate
npx playwright install chromium
npm run screenshots
npm run validate
python3 write_handback.py
npm run serve
```

Open `http://localhost:8080/source/viewer.html` to rotate/zoom, select components, switch LODs and day/night lighting, and display anchors.

`CHROMIUM_EXECUTABLE` can select an existing Chromium binary; `PLAYWRIGHT_MODULE` can select an existing Playwright installation. `node generate.mjs --part=genset_single` or `--lod=H` writes a partial manifest beside the main one. Rerun the full generator for a release. `--quick` skips ray AO and is rejected by final validation.

Add `--update` to merge a selected part or LOD into the main manifest while retaining all other files. The frac M/L correction translates geometry down by the measured 7 mm and preserves the origin and `attach_base`; its High file remains byte-for-byte unchanged.

## Verification and Showroom A

`source/qa/validation.json` records budgets, decoded triangles, texture sizes, BOM and anchor invariance and Khronos validation of compressed and fully decoded data. `source/qa/browser-validation.json` records all 24 real GLB loads, component inspection, transformed-parent snap tests, material attributes, floor clear-bore ray tests in every LOD and all nine offshore mating combinations.

Screenshots are rendered from the GLBs, including day/night views of the offshore floor with the original derrick seated on it. `substructure_drill_floor_A` now uses the supplied `source/references/triple_high.glb`: its yellow structure and hazard rails use the source's linear colour, metallic and roughness factors; its mast pattern follows decoded `mast__mast` lower sections at nominal ±4.5 m. Dimensions stay in metres at unit scale. The source's deck top is about 7.8 m; the new component retains the explicitly requested 9 m floor height and the pass 3 detailed envelope. The target Rig Builder application itself was not present for hosted integration.

## Sources and rights

Original procedural geometry, maps, decal artwork and renders: CC0-1.0. No brand logos or downloaded models/textures are embedded in the runtime parts. The supplied `source/references/triple_high.glb` keeps its original rights and is excluded from this CC0 statement. The original pass 2 engine is reused and extended. Dependency versions and upstream licences are in the lockfile.

Representative class references, checked 31 October 2026:

- [Caterpillar 3512B](https://www.cat.com/en_US/products/new/power-systems/electric-power/diesel-generator-sets/1000028914.html): V12 and prime electrical-output class. The delivered unit is a generic 1,300 kW design.
- [NOV 12-P-160 technical sheet](https://assets.nov.com/NCP4N68N/at/6rt96ptxvfxb7rb3ct5mwsg/12P160_Triplex_Mud_Pump_Spec_Sheet.pdf): 1,600 hp input class and pressure/liner envelope.
- [Lee C. Moore offshore derrick class](https://www.lcm-wci.com/lee-c-moore-secures-new-orders-for-patented-dual-offset-derrick/): 170 ft and 1,500,000 lbf static-load class. Geometry here is an original symmetric design.
- [SPM pump packing sheet](https://s7d2.scene7.com/is/content/Caterpillar/CM20210609-3eb51-a5d0a): frac-pump family and 15,000 psi application context. Hydraulic output and trailer dimensions are representative model assumptions, separate from pump brake horsepower.

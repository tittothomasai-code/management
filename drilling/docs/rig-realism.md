# Rig realism (rig.js)

Visual only. It replaces the placeholder mast lattice with a derrick and box-on-box substructure
built to API Spec 4F standard-derrick proportions, PBR materials and a 3-level LOD.
Physics, animation, drill lines, top drive, drawworks and the "Rig mast" click panel are unchanged.

## Dimensions (metres, `GX.rig.dims`)
| Item | Value | Source |
|---|---|---|
| Height, floor to bottom of crown support beams | 40.0 m (~131 ft) | game rig height (main.js MH), kept so the drill line, block travel and crown stay aligned. Between 4F sizes 16 (122 ft) and 18A (136 ft). |
| Nominal base square, heel to heel | 9.14 m (30 ft) | API 4F size 18A |
| V-window opening | 7.21 m (23 ft 8 in) | API 4F size 18A |
| Drawworks window opening | 2.29 m (7 ft 6 in) | API 4F |
| Smallest clear opening at top | 1.68 m (5 ft 6 in) | API 4F size 18A |
| Gin pole clearance | 3.66 m (12 ft) | API 4F size 18A |
| Racking board above floor | 26.5 m | for ~27 m stands (triples, Range 2) |
| Drill floor height | 8.0 m | game value; box-on-box clear height for the BOP stack |
| Handrail top / mid / toe board | 1.07 / 0.53 / 0.10 m | IADC / OSHA 1910.29 guardrail practice |
| Stairs | ~40° | OSHA 1910.25 range 30–50° |

Layout: drawworks side is -z (drawworks window), V-door and catwalk side is +z (V-window, floor rail open).
Panels get shorter towards the top (4.2 m down to 2.4 m). X bracing on all four faces, none in the windows.
Racking board with fingers on the setback side, caged-ladder rungs on one leg, crown platform rail, crown sheave cluster at the drill-line height, emissive mast lamps (no extra lights).

## Materials (PBR, MeshStandardMaterial)
Paint on structural steel is a dielectric coating: metalness 0, roughness 0.5–0.55 with a small procedural roughness map.
Hot-dip galvanised steel and grating: metalness 1, roughness 0.45–0.6. Floor grating has a procedural bar pattern as roughness + bump map. All textures are generated on a canvas (no downloads).

## LOD (THREE.LOD, `GX.rig.level()`)
| Level | Distance (High) | Content | Members / draw calls |
|---|---|---|---|
| L0 | < 90 m | all bracing, ladder, rails with mid rail + toe board, 6 sheaves, lamps | 426 / 28 |
| L1 | 90–240 m | single diagonals, top rails, 3 sheaves | 215 / 23 |
| L2 | > 240 m | legs, every 3rd girt, crown, floor | 52 / 10 |
Members are InstancedMesh (one per material + section), so draw calls stay low.
Quality Low (phone default) never uses L0 and switches to L2 at 120 m; Medium uses 60 / 180 m.

## Hidden, not removed
rig.js sets `visible=false` (userData.rigOld) on the old main.js lattice/posts/floor/crown box, the ext2.js lattice extras near the well centre (X-bracing, rails, fingers, ladder) and the visual.js mast lamps. Rotary table, casing, doghouse, top-drive guide rails and ext2 crown cluster stay.

## Sources
- API Spec 4F, Specification for Drilling and Well Servicing Structures, table "Derrick sizes and general dimensions" (reproduced at drillingmanual.com/derrick-drilling-rig-oil-gas/), definitions 3.16 (height of derrick).
- IADC Drilling Manual / OSHA 29 CFR 1910.29 (guardrail 42 in ± 3 in, mid rail, toe board 3.5 in min), 1910.25 (stairs).

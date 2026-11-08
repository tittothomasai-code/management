# Showroom C · Detail (SIM)

Hero showcase of one detailed rig: `land_1500_ac_double_detailed` (pass 2), from `assets/rigsc/pass2/manifest.json`. Module `showroomc.js`. Test `showroomc_test.mjs`.

## Open
- Showroom selector (start screen or Tools > Settings): choose **C · Detail**, then the Showroom tile or the HUD 🏁 button. C registers with `GX.showroomAB.register('C',{label,aria,open})` (srpick.js, Showroom B).
- `?demo=showroomc`, or `GX.showroomC.open()`.

## Look
Dark neutral stage, overcast sky dome, a hemisphere fill and one soft sun, a RoomEnvironment reflection map and ACES tone mapping. No saturated colours and no bloom. Night: blue-black sky, sun at 6 %, rig lamps (`light` materials) and cabin HMI screens (`screen` materials) glow, with point lights at the `light_*` nodes (8 on desk, 3 on phone).

## LOD
Desk H. Phone M, or L when dpr > 2.5 or width < 400. `?srclod=H|M|L` overrides it. The pixel ratio is capped at 1.5 on desk and 1.25 on phone.

## Controls
| Action | Mouse/touch | Keys | Gamepad |
|---|---|---|---|
| Orbit / zoom | drag, wheel / swipe, pinch | arrows, + − | left stick, right stick Y |
| Close-ups (overview, top drive, BOP, pumps, cabin HMIs) | bottom bar | 1–5 | RB / LB |
| Explode / inspect | Explode | X | Y |
| Night | ☾ | N | X |
| BOM table | BOM | B | LT |
| Select / drill A→B→C | tap, tap again inside the same part to go deeper | | A, D-pad ◀ ▶ siblings |
| Back | ✕ | Esc (BOM, then card, then showroom), C clears | B |
| Perf readout | ⏱ | P | |

## Drill-down and BOM
Levels come from the manifest `componentPath` depth: 1 = A (major assembly), 2 = B, 3+ = C. The floating card (a bottom sheet on phone) shows the level, BOM id, asset tag, breadcrumbs and children. The BOM table lists every manifest part (H 118, L 117). Click a row to select it; the row of the selection is marked.

## Perf
srperf.js (Showroom B) `attach({id:'C',el,at,lod,ready,match:/assets\/rigsc\//})` on open, `detach('C')` on close. It shows load time, FPS, model MB and the LOD.

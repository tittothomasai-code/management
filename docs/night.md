# Day/Night (feat/night) — night.js

All light values are generic (SIM). Nothing here is real rig data.

## API (`window.GX.night`, also `export {night}` from night.js)
| call | what it does |
|---|---|
| `set(on, scene?, rigRoot?, opts?)` → Promise | Fade to night (`true`) or day (`false`). Resolves when the fade ends. `scene`/`rigRoot` default to the main scene and `rigG`. |
| `toggle(scene?, rigRoot?, opts?)` | Flip that scene's state. |
| `isOn(scene?)`, `t(scene?)` | Target state; current blend 0 (day) .. 1 (night). |
| `stats(scene?)` | `{on,t,quality,stars,sprites,lights,shadowLights,beaconOn,moon,windows,skyOpacity}` (used by tests). |
| `dispose(scene)` | Remove all night objects from that scene (call when the showroom closes). |
| `useThree(THREE)` | Give night.js the THREE module if the main scene has not loaded it (showroom standalone). |

`opts`: `{quality:'low'|'medium'|'high'` (default `GX.quality.get()`), `floorY` (rig floor height, default 17% of rig height), `cabins:[Object3D]` (lit windows), `ren` (WebGLRenderer, exposure is lowered at night), `dur` (ms, default 1500), `instant}`.

State is kept per scene (WeakMap), so the showroom can do:
```js
GX.night.useThree(THREE);
await GX.night.set(true, showScene, rigGroup, {ren:showRenderer, cabins:[doghouse], quality:GX.quality.get()});
GX.night.dispose(showScene); // on close
```
night.js hooks `scene.onBeforeRender` (chains any existing one) to keep the sky dome on the camera.

## What night adds
Sky dome (vertex-colour gradient) + procedural starfield (Points, seeded) + moon sprite. Mast floodlights, derrick lights up the mast, 4 crown lights, a red aviation obstruction beacon on the crown that flashes ~1 Hz (450 ms on, flashing-red style per ICAO Annex 14 / FAA AC 70/7460-1 obstruction lighting), 4 rig floor work lights, lit cabin windows (doghouse/office if placed), additive ground light pools under the mast and on the floor. Existing directional/hemisphere/ambient lights fade to 12%, fog goes dark blue, renderer exposure drops 60%. Night sprites are not tone mapped, so they stay bright.

## Quality
| level | stars | real lights | shadowed | glow |
|---|---|---|---|---|
| Low (phone) | 600 | 0 (emissive sprites + pools only) | 0 | small |
| Medium | 1200 | 3 (2 spot + beacon point) | 0 | small |
| High | 2000 | 6 | 1 floodlight | large halos (bloom look, no post pass) |
Changing quality while night is on rebuilds the night set (listens to `dw-quality`).

## Main scene
Button `#nightBtn` ("☀ Day" / "☾ Night") is added to `#hud`; ui.js moves it into Tools ▸ advanced next to Quality. State saved in `localStorage.dw_night`; `?night=1` / `?night=0` URL override.

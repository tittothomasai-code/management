# Steve's RTOC — isolated WITSML context

This folder is a standalone WITSML 1.4.1.1 reader and whole-well context layer. It does not replace the drilling game and it is not linked from `index.html`.

The audited reference is `wwell.js` v5.12.20 and `wmlinv.js` v5.9.2.3 at `e0ae66a` (`origin/rel/v5.12.12-witsml-dash`). That code reads a recent log window and turns a failed object-list into an empty list. This reader keeps those object types and the SOAP read operations, and changes the coverage behaviour.

## What it speaks

- WITSML **1.4.1.1 SOAP**, read-only: `WMLS_GetVersion`, `WMLS_GetCap`, `WMLS_GetFromStore`.
- WITSML 2.0 and ETP 1.2 are **not implemented**. The context says so. It does not pretend a store was queried.

Transport is injected. This module has no user, password, proxy, or store URL parameter.

```js
import { ingest } from './witsml/reader.js';
import { buildContext } from './witsml/context.js';

const model = await ingest(async ({ op, wmlType, query, options }) => {
  return existingReadOnlyCall(op, wmlType, query, options); // { result, xml, supp }
}, { tag: 'LIVE', redact: [] });
const context = buildContext(model); // JSON-serializable
```

If well or wellbore names contain `SIM-TEST` or `SIMULATED`, a caller tag of `LIVE` is rewritten to `SIM-TEST`. `source.liveVerified` is always `false` here. A live store was not read while this was built.

## Coverage states

Per well, wellbore, and object type:

| Status | Meaning |
|---|---|
| `ingested` | The query succeeded and the returned history was read through the header end, or the object has no further pages. |
| `partial` | Some data was read and then the page cap, row cap, a short page, cancellation, or a stalled cursor stopped the read. |
| `missing` | The query succeeded and the store returned an empty plural. This is not a failure. |
| `unreadable` | The query failed, the XML was truncated, or authentication failed. |
| `unsupported` | GetCap did not advertise the type, or the store returned a not-supported result. The type is not queried when GetCap omits it. |
| `pending` | Not requested yet, usually because the run was cancelled. |

`inventoryComplete` means every branch reached a terminal status. `historyComplete` means every log with a header span was read through that end. Neither flag is named `complete`. One live log does not make the well complete.

Object types, same set as `wmlinv.js`: trajectory, log, mudLog, formationMarker, bhaRun, tubular, rig, wbGeometry, fluidsReport, opsReport, message, risk, cementJob, attachment.

Log pages start at the header start (not the last 12 hours or last 500 m). Continuation uses the last index. A page that does not move the cursor stops with `no-progress`. Depth indexes are converted to metres only for known units (`m`, `ft`, US survey foot, `in`, `km`, `cm`, `mm`). Unknown units stay unconverted. Timestamps with `Z` or an offset become UTC. A timestamp with no zone stays `unspecified` and is not treated as UTC.

Trajectory stations and mud-log intervals are one capped `returnElements=all` read. WITSML 1.4.1.1 has no log-style start index for those objects. Hitting the cap is `partial` / `station-cap`, not a claim that the rest was read.

## Joints

1. Tubular components whose type is drill pipe, joint, HWDP, double, or stand, each with its own reported length. A missing length or a sequence gap stops the chain. Later components stay unplaced. A stand is not split. Component type wins over the length band.
2. Otherwise, operations activities or a `CONN` / `CONNECTION` / `CONNFLAG` curve, when at least two of those events have a depth.
3. Otherwise, pump-off, off-bottom, slips (channel or a clearly lower hookload) boundaries from a time log. The length is the measured distance between those boundaries. 8–11 m is a joint, 17–20 m a double, 25–31 m a stand, anything else `unknown`. The interval before the first boundary is unknown. No pipe length is assumed and no joints are extrapolated to the bit.

Comments are not boundaries. If none of the above exists, `jointCount` is null.

Surveys inside the joint depth are listed with distance 0. If none are inside, the nearest station is listed with its distance. Stations are not interpolated.

A historical selection is a deep copy. Appending samples and ingesting again does not change that copy. "Current joint" follows the open joint on the new context.

## Course board

`ui/board.js` draws the context as a score ribbon and a joint course. Figures come from `ui/scores.js`. A missing joint count stays unknown. Mean ROP is omitted when there are no samples. Branch chips are counts, not a rank or a percent complete. The mode bar uses recorded durations only. Coverage stays in a `<details>` block so it can be collapsed without being removed.

`demo/index.html` is that board plus a synthetic rig. Serve the repository root and open `/rtoc/demo/`. The page says the fixture is test-only. No reference image was supplied for the look, so the course, rail, and score tiles are original and do not use franchise characters or assets.

## Cinematic rig view

F1, the **Cinematic view** button, and Escape are handled by `ui/cinematic.js`.

- The library does not claim F1 unless the caller passes `claimKey: true`. The demo page does. A host that wants the browser's own help key leaves `claimKey` false and uses the button.
- Key repeat is ignored. F1 does nothing while focus is in a text field, select, or contenteditable.
- Escape restores the camera and the clutter only while the cinematic view is on. The next Escape is left for the game. `input.js` already uses Escape to close panels.
- Reduced motion applies the end frame in one step.
- The saved camera is the pre-toggle pose, including `controlsEnabled`. Orbit controls are disabled for the hold and put back exactly. Pumps and other setpoints are not written.
- Safety and sim controls marked `data-rtoc-keep` and `data-rtoc-sim` stay visible. `data-rtoc-clutter` hides.

On `e0ae66a` and on this branch's `ext2.js`, the rig camera is `GX.camMode('orbit' | 'walk' | 'bit')`. `GX.input.orbit`, `zoom`, and `look` exist once `input.js` has loaded. F1 is not bound there. `GX.resetCam` is only an optional call from `vpad.js`. No definition was found, and this controller does not call it.

`tryGameAdapter()` returns `available: false` when `GX.camMode` and `G.cam` / `G.ctl` are absent. The live v5.15.1 tree is not in this repository, so the adapter is not attached to `index.html`. That wiring is pending.

## Demo

```bash
node --test rtoc/rtoc_test.mjs
```

## Integrating later

Do not add a script tag to the game `index.html` until the v5.15.1 game tree is the branch you are editing. Call `ingest` with the game's existing read-only SOAP transport. Keep credentials in that transport. Pass them through `redact` if an error string might echo them. Map `buildContext` onto the RTOC screen; do not replace POB, weather, or VLA modules.

## Known limits

- Live coverage is unverified. No store credentials were used.
- Attachment bytes, full tubular catalogs beyond the requested fields, and WITSML 2.0 objects are out of scope.
- Depth/time crosswalk is not used as a boundary time. Joint times are unknown unless a boundary sample or a connection event carried a timestamp.
- Signal joints are estimates. They need a time log with flow, rpm, bit depth, hole depth, and either slips or hookload, all in metres for the depth channels.
- The game at https://drilling.robotyx.systems was v5.15.1 when last read, which is not this git tree. This folder does not recreate that game.

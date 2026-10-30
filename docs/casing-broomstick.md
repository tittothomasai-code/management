# Casing broomstick (feat/casing-broomstick)

Module `broomstick.js`. Open with the **Casing broomstick** tool button or `/?broomstick=1`. HUD: shows by itself in the casing run (`/?demo=casing`, `window.dwOps`). Hook: one line in `ext3.js`.
All values **SIM**. Nothing is LIVE. No network writes.

## What it shows
- Model hookload vs shoe depth: pick-up (solid), slack-off (dashed) for μ = 0.1, 0.2, 0.3, 0.4, and rotating (dotted). From `casingtd.js` `broomstick()` (commit 4099b45). No new T&D engine.
- SIM "measured" points: `td.so` from the `ops3d.js` run timeline (`stateAt`) with a ±1 % deterministic sensor scatter.
- Apparent friction factor: measured SO interpolated between the model SO curves at that depth. Not read where the curves are within 5 % (near-vertical hole).
- HUD in the casing run: hookload (SO) in kN and t, apparent μ, and a small broomstick with the run trail (replayed from `stateAt` when the HUD starts).

## Sources
- Johancsik, Friesen, Dawson (1984), *Torque and Drag in Directional Wells – Prediction and Measurement*, SPE 11380 (soft-string model, used inside casingtd.js).
- Aadnøy, Fazaelizadeh, Hareland (2010), *A 3D analytical model for wellbore friction*, JCPT 49(10) (friction factor ranges).
- IADC Drilling Manual, casing running chapter: broomstick plots, typical friction factors 0.15–0.25 cased hole, 0.25–0.40 open hole.

## Test
`node broomstick_test.mjs http://localhost:8834` → 20 pass, 0 fail. Shots: `shots_live/162_broomstick_{phone,desk}_{chart,hud}.png`.

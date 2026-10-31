# Retired tests (v5.12.4, one showroom)

These tests cover UI that v5.12.4 removed on purpose. They are kept for history, not run.

| Test | What it covered | Why retired | Now covered by |
|---|---|---|---|
| srswitch_test.mjs | A\|B\|C header switch (v5.12.1.2) | Switch removed; one showroom. A (classic) only via Settings toggle | srasetting_test.mjs (toggle off/on/reload, "Showroom \| A (classic)" switch), showroom_one_test.mjs (no switch, old links/settings open one showroom) |
| showroomb_test.mjs | Showroom B screen + A/B toggle | B screen unhooked; B rigs, stat bars, sound, rig switcher, select live inside the one showroom | showroom_one_test.mjs (20-rig list incl. 10 B rigs, stat bars x4, mute, prev/next, Use this rig, dw-rig event) |
| srbassets_test.mjs | Assets slider inside Showroom B | Slider lives in the one showroom | showroom_one_test.mjs (slider open, tap-to-zoom, Esc) |

B's model files and showroomb.js (manifest, BARS, sounds) are still used by showroomc.js.

# BHA model resources

All geometry and procedural surface images in `geometry.js`, `pdc-bit.js` and `assets/` are
original works released under CC0-1.0. Commercial use and modification are permitted.
See `asset-license.txt`. No external equipment CAD, logos or model library is used.

| Model | Source | Licence |
| --- | --- | --- |
| PDC bit | `assets/pdc-bit.glb`; `pdc-bit.js` | CC0-1.0 |
| Roller-cone bit | `assets/roller-bit.glb`; `geometry.js` | CC0-1.0 |
| Core bit | `assets/core-bit.glb`; `geometry.js` | CC0-1.0 |
| Near-bit sub | `assets/near-bit.glb`; `geometry.js` | CC0-1.0 |
| Mud motor | `assets/motor.glb`; `geometry.js` | CC0-1.0 |
| Rotary steerable tool | `assets/rss.glb`; `geometry.js` | CC0-1.0 |
| Float valve sub | `assets/float-sub.glb`; `geometry.js` | CC0-1.0 |
| Orienting sub | `assets/ubho.glb`; `geometry.js` | CC0-1.0 |
| Pony collar | `assets/pony.glb`; `geometry.js` | CC0-1.0 |
| Gap sub | `assets/gap-sub.glb`; `geometry.js` | CC0-1.0 |
| Nonmagnetic drill collar | `assets/nmdc.glb`; `geometry.js` | CC0-1.0 |
| MWD collar | `assets/mwd.glb`; `geometry.js` | CC0-1.0 |
| MWD probe | `assets/mwd-probe.glb`; `geometry.js` | CC0-1.0 |
| Gamma tool | `assets/gamma.glb`; `geometry.js` | CC0-1.0 |
| Resistivity tool | `assets/resistivity.glb`; `geometry.js` | CC0-1.0 |
| Density tool | `assets/density.glb`; `geometry.js` | CC0-1.0 |
| Sonic tool | `assets/sonic.glb`; `geometry.js` | CC0-1.0 |
| Spiral stabilizer | `assets/stabilizer.glb`; `geometry.js` | CC0-1.0 |
| Straight stabilizer | `assets/straight-stabilizer.glb`; `geometry.js` | CC0-1.0 |
| Roller reamer | `assets/reamer.glb`; `geometry.js` | CC0-1.0 |
| Hole opener | `assets/hole-opener.glb`; `geometry.js` | CC0-1.0 |
| Crossover sub | `assets/crossover.glb`; `geometry.js` | CC0-1.0 |
| Safety joint | `assets/safety.glb`; `geometry.js` | CC0-1.0 |
| Drilling jar | `assets/jar.glb`; `geometry.js` | CC0-1.0 |
| Shock sub | `assets/shock.glb`; `geometry.js` | CC0-1.0 |
| Drill collar | `assets/collar.glb`; `geometry.js` | CC0-1.0 |
| Spiral drill collar | `assets/spiral-collar.glb`; `geometry.js` | CC0-1.0 |
| Heavyweight drill pipe | `assets/hwdp.glb`; `geometry.js` | CC0-1.0 |
| Drill pipe | `assets/drill-pipe.glb`; `geometry.js` | CC0-1.0 |
| Core barrel | `assets/core-barrel.glb`; `geometry.js` | CC0-1.0 |
| Core catcher ring | `assets/core-ring.glb`; `geometry.js` | CC0-1.0 |
| Fishing sub | `assets/fishing-sub.glb`; `geometry.js` | CC0-1.0 |

PBR base colour, roughness and normal images are authored 64×64 procedural PNGs.
They remain below the phone and desktop texture ceilings.

Three.js and its controls are MIT licensed. The build includes `vendor/three-license.txt`.
Source: https://github.com/mrdoob/three.js .

GLB authoring uses glTF Transform and meshoptimizer, both MIT licensed, plus
PNGJS (MIT). These build tools are not loaded remotely by the game. A GLB consumer
needs a compatible meshopt decoder. The procedural game viewer does not need one.

The shared BHA library and validation come from the existing Robotyx source at
`spatial-studio-hse/dist/planning-library.js` and its pure tracking dependencies.
They retain their original repository licence. The CC0 model dedication does not
change the licence of the existing application, library or third-party tools.

# Compact drilling dashboard equipment status

The Ops header contains a small pump status dot/text and a narrow top-drive rail.
There is no separate equipment card, large pump drawing or continuous animation.
The reminder remains beside the existing dashboard readings and navigation.

Pumps on/off is inferred from fresh positive/zero WITSML flow in. Stale/missing time-series readings show an unavailable state; valid depth-log
readings are shown as reported values with their source labelled. Source
notes remain in the indicator tooltip. The existing time-log reads are reused;
there are no additional WITSML calls, writes or credential changes.

The top-drive rail uses a direct top-drive height/position channel when reported.
Otherwise it uses BHE/BPOS block height, visibly labelled `Block proxy`. It shows
height in metres and Rising, Lowering or Holding from consecutive readings. Feet
are converted to metres. Bit depth and hole depth are never used as top-drive
position. Missing units, stale samples and depth-only history cannot show a
current position marker.

Rail endpoints show the observed sample range, not an invented full mast height.
A fixed or too-small observed range shows the numeric height with `range pending`
and no arbitrary marker position. The graphic does not claim a calibrated floor
or crown reference. Secondary log samples remain scoped to their well/bore/log.

## Validation and screenshots

`npm test --prefix drilling-tests` passes 22 unit/installer checks. The browser
suite runs the actual Ops renderer and parsers with local SIM transport at
1920×1080 and 390×844. It checks pump states, header placement and compact height,
carriage movement, Rising/Lowering/Holding, direct-channel preference, secondary
log reuse, stale/well isolation, the BHA entry and the existing survey popup.
All external requests are blocked. Current screenshots and results are under
`equipment-evidence/`. The earlier large pump illustration is superseded.

Run browser checks with:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node drilling-tests/survey-alert-browser.mjs
```

## Release

The full verified release archive must include `opsnow.js`, `opsnow_pumps.mjs`
and `opsnow_pumps.css`, with the Ops script URL set to `?v=depth1118`. Keep the
BHA launcher, survey notification assets and other workspace files. Follow the
existing HANDOFF.md inventory, unpublished-preview and rollback process before
publication. Rollback restores the previous Ops module and entry URL. There is
no migration, billing or account change.

## Depth-indexed live feed correction

BHE, Flow and SPP from the active depth log are now displayed as reported readings,
explicitly labelled `depth log`. Negative BHE values are retained. The poll includes
the latest depth row and refreshes its values when they change at unchanged MD,
without marking the hole as advancing. Missing flow falls back to a clearly
labelled SPP inference (`Pumps likely on/off`). No numeric flow is invented from
pressure; that requires a calibrated hydraulic relationship and residual/trapped
pressure remains possible. Direct flow always takes precedence, including zero.

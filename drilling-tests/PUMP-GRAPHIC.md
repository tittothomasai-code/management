# Ops pump activity graphic

An original schematic motor, coupling, pump body and flow pipe is displayed above
the drilling parameter tiles. ON uses a green motor/flow animation. OFF is
stationary. UNKNOWN is stationary and amber. Words accompany all colour states.
Reduced-motion mode stops the animation while preserving the state and reading.
This is a read-only aggregate indicator, not a pump control or individual motor
switch indication. The UI labels the state as inferred from flow in.

ON means positive reported flow and OFF means exactly zero reported flow. Neither
requires a unit-specific engineering threshold. The flow sample must be from a
time-indexed source, younger than 120 seconds, with advancing sample times. Future
timestamps, negative/missing values, a missing latest reading, stale readings and
depth-only logs produce UNKNOWN. Old depth-log readings can remain positive after
pumps stop, so they must not be presented as a current ON state. Last readings are
labelled as historical. Header refresh timestamps alone do not prove freshness.

The main time-log flow is reused when available. If the primary log is indexed by
depth, the existing secondary time-log read also supplies its flow channel. No
additional WITSML request or credential handling is added. Secondary samples are
scoped to their well/wellbore and log; old responses and other-well samples are
ignored. The existing survey alert and BHA launcher remain in place.

## Tests and pictures

```sh
npm test --prefix drilling-tests
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node drilling-tests/survey-alert-browser.mjs
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node drilling-tests/bha-pictures.mjs
```

Fifteen unit/installer tests pass. Browser checks run the actual Ops renderer,
parsers, existing secondary time-log reader and report callback with local SIM
transport at 1920×1080 and 390×844. They cover ON, OFF, stale/depth/missing UNKNOWN,
animation, reduced motion, well isolation, BHA entry presence and the survey alert.
All external requests are blocked. Screenshots in `pump-evidence/` include full
dashboards and individual cards. Survey screenshots are in
`survey-alert-evidence/`. `bha-component-pictures/` has a full-tool view and detail
for every authored BHA profile, rendered together at 1400×1000 with true dimensions.
These are genuine code/model captures and SIM examples, not live equipment photos.

## Release

The current release must include `opsnow.js`, `opsnow_pumps.mjs` and
`opsnow_pumps.css`, with the Ops script URL updated to `?v=pumps1117`. Keep all
existing entry tags, including the BHA context launcher and survey alert assets.
Use the full verified release archive and the existing HANDOFF.md preflight,
preview and rollback process. No production publication is performed by these
tests or picture scripts. Rollback restores the old Ops module/entry URL and
removes the two pump assets. No storage, billing or schema change is required.

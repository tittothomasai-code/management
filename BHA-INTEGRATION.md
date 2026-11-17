# BHA builder in Drilling World

The same BHA editor is available from Tools, the Directional Drilling training
cabin and the engineering Operations dashboard. The separate Ops and Well Plan
pages open it in an embedded panel. Back or Escape returns to the existing
workspace. The game entry uses its original scene, camera and canvas.

The module has 32 detailed schematic tool profiles, desktop and phone row
ordering, an editable report table, cumulative lengths, immutable saved versions,
JSON, CSV and a printable report. The example PDC bit is now 300 mm long.
Its crown and cutters retain their sizes; the body and threaded shank are longer.
Readable assembly preserves the bit aspect ratio. Saved dimensions are unchanged.

## Source and scope

Module source: `tittothomasai-code/the-dome`, PR #824, `build/field-pumps-site`.
The copied module's `build-info.json` identifies its exact source commit.
This game patch targets `codex/drilling-production-baseline`, baseline commit
`b6cace8d960b78895ada969b648462b776090105`. The corporate root index is untouched.

The baseline predates published frontend updates. A separate source-alignment
commit copies the public current static frontend bytes from
`https://drilling.robotyx.systems` before the BHA entry tags are added.
`drilling-tests/bha-source-audit.json` records the 143 root frontend comparisons
and source hashes. It is not a complete release archive inventory. Field pumps,
Field assets and existing keyboard/navigation hooks are preserved in the current
entry HTML. No live API data, credentials, upstream XML or account records were
copied. No deployment or merge is part of this change.

## Apply to a current release

Use the verified complete current release archive, rather than publishing this
older baseline checkout as a replacement release. Copy only `drilling/bha-builder/`
into that archive, then run:

```sh
node drilling-tests/install-bha.mjs /path/to/current-release
```

The installer adds two game script tags after the Three import map and before
keyboard guards, plus the context launcher on Ops and Well Plan. It preserves all
other markup and scripts. It validates all three entry files before writing and
saves `.before-bha` HTML backups. Repeated installation makes no additional edits.
It does not publish anything. The downloadable overlay contains the module and
installer; it contains no replacement rig, Ops, Field or physics files.

Before a future release, follow `HANDOFF.md`: verify the full current inventory,
compare an unpublished deploy and test target devices. Preserve the current
published deploy as the rollback target. This PR is not authorization to switch
production. Rollback restores the three HTML backups and removes the BHA folder.
Existing saved library records stay in the browser.

## How to build a report

1. Open BHA builder from Tools, Ops or Directional Drilling.
2. Load the simulated example, or add a bit and tools from the component library.
3. Drag row handles into bit-to-top order. Enter dimensions, serials, hours,
   connections and torque. Open Details for well, run, bit and motor information.
4. Name the assembly and select Save version. Export JSON for transfer between
   devices, Export table for CSV, or Report / PDF for a printable report.
5. Return to the workspace. Opening the editor again keeps the current draft.

## Validation

Validation passed: eight focused geometry/data tests, ten browser workflow checks,
nine host checks, four Ops/DD context checks, two menu-order checks and three
additive-installer tests. The source full build passed with 2,768 tests passed,
three skipped and no failures. Recorded results and
screenshots accompany this PR under `drilling-tests/bha-evidence/`.

```sh
cd drilling-tests
npm install
npm test
npm run test:host
npm run test:contexts
```

The host test uses the actual candidate entry HTML and module files. Missing
unchanged game assets fall back to read-only public static files. The context
test covers Ops save/return/reopen and loading that saved report from Directional
Drilling, cabin-state restoration, the original game canvas, and Plan-before-Drill
menu order, at desktop 1920×1080 and phone 390×844. All writes and API calls are
blocked in the context test. This is software WebGL and phone emulation, not a
physical-device performance claim.

## Limits

All example geometry and values are simulated, schematic and unverified. The
editor does not change the active drilling BHA, live well, steering commands,
permissions, account state or billing. Saved reports use the existing
`robotyx.demo.bha-library.v1` origin-local store. They are not synchronized between
accounts or devices. The static GLB bank is supplied for reuse; the editor builds
parametric geometry locally rather than fetching all GLBs. Sources and licences
are listed in the module's `RESOURCES.md`.

## Ops survey receipt alerts

Ops now pulses a green card when a new WITSML survey or geosteering report is
received through its existing read cycle. It then stays visible until dismissed.
Initial history, repeated polls, backfill and generated-file-only changes are quiet.
The card shows well/bore, MD, inclination, azimuth and source. Reduced-motion mode
keeps a steady green card. Existing polling cadence is unchanged. See
`drilling-tests/SURVEY-ALERT.md` for validation, screenshots and release details.
The Ops script version change and notification assets must accompany this feature;
keep the BHA context-launcher tag when updating the current release entry HTML.

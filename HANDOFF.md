# Drilling game handoff

The publish root is `drilling/`. The corporate website keeps its root `index.html`.

## Production baseline

- Site: drilling.robotyx.systems
- Netlify deploy: `6af0101120755d231cb6b0df`
- Published: 8 November 2026 at 4:00 pm AEST
- Deploy archive SHA-256: `c611180bc72bd0eb65fc668bff9b8920437cbfc791ab565f25e2b37f1fd0fc7a`
- File count: 375. The source snapshot uses the paths and exact file bytes exported by Netlify.
- Netlify serves vendor asset paths case-insensitively. Mirror that behaviour when testing a downloaded deploy on a case-sensitive filesystem.

This deploy contains Flow/Pressure from PR #14 at `8aa52804`, the Operations dock from PR #11 at `8becc1e6`, and later transport and cache updates. The archive includes the published Netlify configuration.

## Work and releases

Preserve the accepted intro, Plan-before-Drill menu, rig, physics, assets, RTOC, Operations, Drops, Flow/Pressure and existing game controls. Preserve the intro and the protected workspaces.

WITSML is read-only. Keep credentials and raw upstream XML out of logs and commits. Use existing parsers and proxy. Use synthetic fixtures for offline tests. Show live status only for advancing source timestamps under 120 seconds old. Keep joint, hole, bit, survey, gamma and LWD depth references distinct.

Use the verified current deploy as the base for a focused patch. Verify the complete file inventory, test desktop and mobile, and compare an unpublished deploy before switching production. Record the previously published deploy ID as the immediate rollback target.

## Operations live-only release candidate

The Operations dashboard displays values from advancing WITSML time logs. It keeps hole, bit, survey, gamma and LWD depths separate, shows connection intervals and survey pickup from measured data, and includes a DLS tab on absolute survey MD. Dashboard trends stay inside the reported active joint window.

The complete candidate contains 375 files with seven runtime changes. Local desktop and mobile fixture tests and the full Operations route smoke passed. See drilling-tests/ for offline tests. Copy the test files into an isolated copy of drilling/ before running. The candidate's Netlify ZIP SHA-256 is `9cba075a89a6ffa7f04fa843598460fee31d760ee6bfba69d7926ba73d67cc60`.

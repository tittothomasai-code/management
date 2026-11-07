# Drilling operations release

## Production baseline (verified 8 November 2026, AEST)

- Host: Netlify site `robotyx-drilling`, ID `d548e1ee-91eb-4166-a2bd-d8fdb7fbd5a9`.
- Published deploy and rollback target: `6aef9d63111effabca016bae`.
- Immutable URL: https://6aef9d63111effabca016bae--robotyx-drilling.netlify.app
- Published at 07:51:36 AEST. CLI artifact deployment, no build ID, branch or source commit recorded by Netlify.
- The GitHub Pages workflow deploys `gh-pages`, not this production artifact.
- Production assets do not match the release branch. Do not deploy the repository directory wholesale.
- The baseline includes the startup intro, Plan-before-Drill menu, DROPZ, RTOC and newer game imports. Preserve these files and hooks.

The published file manifest has 365 entries. The local production backup matches all 364 downloadable runtime assets by SHA-1. Netlify's generated `netlify.toml` is not publicly downloadable. The immutable baseline index also matches production by SHA-256.

## Candidate assembly

`operations_release.mjs` takes the verified baseline directory, an empty output directory and its file-hash manifest:

```sh
node operations_release.mjs BASELINE EMPTY_CANDIDATE BASELINE_MANIFEST
/workspace/drill-sim/drilling-guard.sh EMPTY_CANDIDATE
```

The script checks every baseline file hash, applies only the dashboard changes, and preserves unrelated production files. It resolves overlapping import-cache hooks explicitly. The operations deep link skips the startup intro and does not require a simulator player profile. Other routes keep their existing startup behavior. The dashboard and its connection panel stay above unrelated floating simulator controls. It refuses unexpected conflicts. It writes `operations-release.json` with the dashboard commit and baseline deploy ID. Keep the manifest and baseline with the release evidence, not in the public repository.

Before publication, check that the published Netlify deploy is still the recorded baseline. If it changed, stop and assemble against the new baseline. Use the existing CLI artifact workflow with `--no-build`, the exact site ID, and the assembled directory. Do not stage or deploy the repository directory directly. Run browser and asset-hash smoke tests after publication. Restore the recorded deploy with Netlify's `restoreSiteDeploy` operation if smoke tests fail.

## Tests

```sh
node operations_data_test.mjs
node conn_test.mjs
node wdash_unit_test.mjs
```

The connection picker ignores out-of-order responses, disables Start while headers load, and rejects log headers from a different wellbore.

The adapter rejects false LIVE states: no time-indexed log, no actual source rows, invalid sample timestamps, and stale source timestamps.

For the local-only browser regression, start these in separate terminals:

```sh
python3 -m http.server 8845 --bind 127.0.0.1
WITSML_PROXY_ALLOW=http://127.0.0.1:8847 node witsml_proxy.mjs 8846
MOCK_PORT=8847 MOCK_START=52 node mock_upstream.mjs
python3 operations_browser_test.py --base-url http://127.0.0.1:8845
```

The browser test needs Python Playwright and Chrome. It uses only the local SIM-TEST store. It checks the non-automated startup path on desktop and mobile, the 3D view and overlays, joint tally, execution controls, mapped and missing channels, sample updates, matching image log, waiting/depth-log states, stale state and read-only SOAP operations. Fixture timestamps are not proof of a real feed.

## Real feed gate

The approved proxy currently returns HTTP 403 to an OPTIONS preflight from `https://drilling.robotyx.systems`. No credentials were sent in that check. Its documented origin allow-list only includes the GitHub Pages origin. Titto must approve the exact drilling-origin allow-list addition. The proxy owner can then release that change before this site can connect. Do not use another origin or proxy to bypass this restriction.

Credential availability does not prove access or freshness. Mark live validation complete only after two successive new source samples appear for an authorised well, matching wellbore and active time log, with execution disabled. Record the source timestamps, not request or receipt times. Keep credentials out of output, screenshots and source files.

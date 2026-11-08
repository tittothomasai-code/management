# Drilling operations release

## Production baseline (verified 8 November 2026, AEST)

- Host: Netlify site `robotyx-drilling`, ID `d548e1ee-91eb-4166-a2bd-d8fdb7fbd5a9`. Direct CLI artifact. No linked repository, branch, build ID, or commit.
- Public site checked 8 November 2026 at 14:02 AEST: https://drilling.robotyx.systems matches deploy `6aefa5b44e57e24ef002a2f3` (title recorded by the host audit as Drilling operations PR5). 371 platform files = 370 published files plus Netlify's `netlify.toml`.
- That deploy's public `operations-release.json` records `dashboard_commit` `21ccbad3ddb4a71f3fd6d02a914838c877396f26` and `baseline_deploy` `6aef9d63111effabca016bae`. The commit is provenance. It is not byte identity for `index.html`, `start.js`, `intro.js`, or `dropz_boot.js`.
- `final-candidate-v6` is not this baseline: its `operations-release.json` says `f5131ebc3d81142169613897414289921ff95d7d`. Do not publish that candidate or `ops-live-fix/rev2` as a directory. Rev2's manifest repeats the stale commit and differs from production by more than the four overlay files.
- The next authorized publication copies `operations.js`, `operations.css`, and `operations_data.js` onto deploy `6aefa5b44e57e24ef002a2f3`. The published production loaders are `operations.js?v=1` inside `start.js` and `start.js?v=ops1` inside `index.html`. Change only those two query strings to `r12c`. `ol2` was a branch token, not a published production loader. Do not replace `index.html` or `start.js` with the release-branch copies. Plan-before-Drill, the intro, DROPZ, and RTOC stay. `operations.js` imports `operations_data.js?v=r12c` and `operations.css?v=r12c`, so a returning browser cannot keep the old adapter with the new UI. The WITSML button docks the existing panel inside Operations and does not stop the poll when the panel closes. `draft-fixture/` is a separate draft-only package. Do not copy it onto this production deploy.
- Earlier rollback target recorded for the pre-operations artifact: `6aef9d63111effabca016bae`. Confirm the live deploy again before any restore.
- Pre-operations artifact: https://6aef9d63111effabca016bae--robotyx-drilling.netlify.app published at 07:51:36 AEST. Its index does not match the current public site.
- Current public index matches https://6aefa5b44e57e24ef002a2f3--robotyx-drilling.netlify.app. Netlify recorded no build ID, branch, or source commit for either artifact.
- The GitHub Pages workflow deploys `gh-pages`, not this production artifact.
- Production `index.html` and `start.js` do not match this release branch. Do not deploy the repository directory wholesale.
- The live site includes the startup intro, Plan-before-Drill menu, DROPZ, RTOC and newer game imports. Preserve these files and hooks.

The 07:51 manifest had 365 entries. The 14:02 host audit counts 371 platform files on the current deploy. Netlify's generated `netlify.toml` is not publicly downloadable. This VM does not have the nightly stage folder; do not upload an older stage tree.

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

The adapter rejects false LIVE states: no time-indexed log, no actual source rows, invalid sample timestamps, stale source timestamps, and fixture provenance. A fixture is the existing simulated flag, SIM-TEST, SIMULATED, synthetic, or FIXTURE / NOT LIVE text on the well, wellbore, or log, SuppMsgOut, a localhost store, a `.invalid` store host, or a `/sim/witsml` store path. A loopback or custom proxy in front of an ordinary https store is not itself a fixture. The approved proxy and a custom https store with ordinary names can still be WITSML LIVE. A test feed never uses that badge.

For the local-only browser regression, start these in separate terminals:

```sh
python3 -m http.server 8845 --bind 127.0.0.1
WITSML_PROXY_ALLOW=http://127.0.0.1:8847 node witsml_proxy.mjs 8846
MOCK_PORT=8847 MOCK_START=52 node mock_upstream.mjs
python3 operations_browser_test.py --base-url http://127.0.0.1:8845
```

The browser test needs Python Playwright and Chrome. It uses only the local SIM-TEST store. It checks the non-automated startup path on desktop and mobile, the 3D view and overlays, joint tally, execution controls, mapped and missing channels, sample updates, matching image log, waiting/depth-log states, stale state and read-only SOAP operations. Fixture timestamps are not proof of a real feed.

## Real feed gate

Titto approved adding exactly `https://drilling.robotyx.systems` to the existing proxy origin allow-list. Proxy deploy `6aefa4b9ac1f54a1b3ca499b` passed HTTP 204 preflight checks for the drilling origin and the existing GitHub Pages origin on 8 November 2026 at 08:23 AEST. The upstream, read-only operations, credential handling, TLS behaviour and rate limits are unchanged. Proxy rollback target: `6aef99da62a9a373c6c67c7b`.

Credential availability does not prove access or freshness. Mark live validation complete only after two successive new source samples appear for an authorised well, matching wellbore and active time log, with execution disabled. Record the source timestamps, not request or receipt times. Keep credentials out of output, screenshots and source files.

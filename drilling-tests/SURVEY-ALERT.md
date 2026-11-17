# Ops survey receipt popup

The Ops dashboard shows a green `Survey received` card when an existing data
read receives a new survey. It pulses three times over 3.6 seconds, then stays
visible until Dismiss. The card shows well, wellbore, measured depth, inclination,
azimuth and source. It does not take keyboard focus or require browser permissions.
Reduced-motion mode keeps the green card without animation.

Both sources already used by Ops are connected: WITSML trajectory stations and
geosteering report survey data. First-load history is a silent baseline. Unchanged
polls, old backfill, projections, imported plans, missing-survey rows, and report
file timestamp changes do not generate alerts. Report provenance is tracked once
per source report, rather than once per interpolated joint. A new report at the
same depth can still notify. State is isolated by well, wellbore and source. Old
in-flight responses are ignored after a wellbore/trajectory switch. Signing out
or selecting another wellbore clears the visible notice.

The current published source is recorded in `survey-source.json`. The initial
snapshot commit is kept separate from the notification changes so reviewers can
see the actual patch against the live Ops module. Existing read-only transport,
credentials, storage, polling rates, source-freshness labels and unrelated game
controls are unchanged. This adds no API or database calls.

## Timing

The alert appears when the dashboard receives new data, not at the moment the
source creates it. Existing nominal intervals remain two minutes for WITSML
surveys and ten minutes for report surveys; sequential jobs, retries or an offline
connection can delay receipt. This change does not add a server push connection.
An already-open old dashboard must be reloaded after release.

## Verification

```sh
node --test drilling-tests/survey-alert.test.mjs
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node drilling-tests/survey-alert-browser.mjs
```

Seven focused tests cover baseline, duplicate suppression, batches, historical
backfill, timestamps, empty/error reads, well/source isolation and report
provenance. Browser checks run the actual Ops module, trajectory parser and report
loader at 1920×1080 and 390×844. Read/render functions are exported only in the
test server's response, not in production. Transport is a local SIM stub and other
workspaces are stubbed; all external requests are blocked. No real credentials or
upstream XML are used. Tests cover both source hooks, green animation, dismissal,
focus, stale responses, reduced motion and viewport fit. Screenshots and results
are in `survey-alert-evidence/`.

Static copies of the current parser, report loader and stylesheet are test-only
fixtures, allowing the checks to run without downloading dependencies from the
live site. They contain source code, not live well data.

## Release and rollback

Apply the changed Ops module and the two new alert assets to the verified current
complete release archive. Update only the Ops script version in its existing
entry HTML; preserve other tags, including the BHA context launcher. Never deploy
a partial overlay as a replacement for the full game. Follow the game HANDOFF.md
inventory, unpublished-preview and rollback steps before publishing.

Rollback restores the previous Ops module and entry-script version and removes
the two alert assets. There is no migration, billing or credential change.

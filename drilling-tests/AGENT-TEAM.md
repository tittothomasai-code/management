# Operations well team status

RBX-2527 adds one collapsed Well team panel to Operations. MWD checks telemetry and
survey quality, Geosteering assesses available reservoir evidence, and Steve is the
DD supervisor. Opening the panel shows each role's finding, missing inputs, source
time, last check, last verified model review and decision reference. A check does
not imply a model ran. The display has no rig controls or send buttons.

The existing authenticated private-context frame supplies `policy.agent_team`.
Its tenant, source, well and bore must all match the enclosing private policy;
the current view's well/bore and explicit connection are also checked. Missing or
invalid payloads show unavailable. Switching bore or signing out clears prior
findings. Source evidence older than 120 seconds, future timestamps or a check
older than 180 seconds cannot show Watching. An expired/disabled policy or a
historical view shows Paused. The panel reevaluates freshness every ten seconds.

The component makes no extra network request and cannot start models, ingest data,
send mail or change controls. The source worker owns checks and model execution;
this panel reports the supplied evidence only. Missing model timestamps stay
explicitly unverified. Browser fixtures are entirely synthetic.

Checks:

- `node --test drilling-tests/agent-team.test.mjs`
- `node drilling-tests/agent-team-browser.mjs`
- `npm test --prefix drilling-tests`
- Set `AGENT_TEAM_PREVIEW_URL` to test the actual unpublished app payload with
  synthetic source and private-context fixtures. Browser checks block real source,
  model and rig requests.

Local validation: 217 unit checks passed. Team status, existing watch-zone/BHA
context and current-well selection browser checks passed at 1920×1080 and 390×844.
No live models, sources or equipment were called by these fixtures.

Screenshots: `agent-team-evidence/team-dashboard-{1920,390}.png` and
`agent-team-evidence/team-details-{1920,390}.png`. The release workflow runs the
same desktop/phone checks against the unpublished candidate and saves the evidence
before promotion. It preserves the existing production inventory and rollback.

Rollback the static release to its recorded prior deployment. Preserve all agent
runs, source captures, policies and immutable decisions. Hiding this display does
not itself pause a server monitor.

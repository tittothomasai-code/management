# DR101L WB04B01: reported TD and liner phase

The user supplied an unobscured entire-lateral summary on 18 November 2026
(Australia/Brisbane), and explicitly reported that the well had reached TD
and was running liner. This is a dated human operational report, separate
from WITSML measurements. Neither the screenshot nor the message provides an
exact TD time, liner start time, liner depth, liner tally or measured final
drilling joint count. None is invented.

Source facts retained in `opsnow_operation_report.mjs`:

- KOP: 822.53 m MD; TD: 2618.90 m MD; lateral: 1796.37 m.
- In seam: 1774.37 m (98.78%).
- Faulted exits: 1826–1832 and 2223–2239 m MD; total 22 m.
- Stratigraphic exits: none reported.
- TD reason, quoted from the supplied summary: “Well heavy scrape the floor.
  Rig issues and potential stuck pipe.” This is a reported reason, not an
  independent diagnosis of a stuck string.

The report applies only to DR101L/DR0101L and the explicit WB04B01 aliases,
and is not applied to replay dates before 18 November AEST. The date is the
report date, not a fabricated operational timestamp. Future users continue
to see the dated “reported” label, rather than a claim of fresh telemetry.

Ops displays the dated phase and collapsible source facts. It retains raw
source hole/bit depths, freshness, pumps, BHE and surveys. Positive ROP/RPM
in a depth-indexed last row cannot imply current drilling or derive a
missing bit depth. A source hole MD greater than reported TD is visibly
flagged; neither source value nor reported TD is silently clamped to fit.

The inventory card refers to reported final TD, independent of later tool
positions. Entry 208 remains an MD inventory reference, not confirmation of
the measured drill-string count. There is no active drilling progress bar,
expected next connection or claim that the final partial MD advance is a
full physical pipe length. The existing BHA reference is retained once.

Tally labels its available drilling history and possible partial coverage.
A later tool depth or time-log activity does not imply that the historical
drilling string is currently in the hole, or create liner runs/counts.
Midnight reminders pause for the completed drilling run; retrospective
measured hardpoints, their revisions, exports and raw history remain intact.
Uploads and historical edits remain available. No measured hardpoint is
created from the screenshot or from inventory entry 208.

Existing EDM branches stay planned. The slide is not a full-resolution
as-drilled survey, and supplies no surrounding offset trajectories. The
earlier 10 km assessment remains incomplete until those data are loaded.

Verification: 64 unit tests, including report scope/date, arithmetic checks,
absent operational times, fixed TD reference under tool movement and depth
conflict preservation. The actual Ops/Tally source runs on desktop and phone
with local SIM transport: positive last-row drilling rates, missing bit,
reported off-bottom tool position, preserved TD reference, paused reminders,
depth conflict, wrong-bore exclusion, historical tally labels and layout.
SIM data is restricted to tests. Screenshots are under
`equipment-evidence/reported-td-*.png`.

Release checks exercise the actual unpublished deploy and its scoped report
module alongside existing Ops, Tally, BHA, DD, menu and EDM checks before
promotion. All unchanged production paths are preserved. Runtime changes
are confined to the report, Ops, Tally and the hardpoint reminder text.

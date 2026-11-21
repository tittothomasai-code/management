# Operations report watch zones and BHA source preview

The dashboard has a small, collapsed report-watch strip. Open it for source controls. An active interval needs fresh reported bit depth and verified datum alignment. Missing alignment shows position unverified. MD and TVD are distinct; there is no inferred TVD and no green all-clear.

Open 3D wells to see sourced risk bands on the reference plan. Where actual alignment is unverified, the view is explicitly REPORT PLAN ONLY. Colours are overlay ribbons, not physical clearance radii. Only supplied hazard types have layer controls; no geology is invented.

Open BHA builder, then Well designs, to inspect private source assemblies when the signed-in Robotyx source context supplies them. Use the design and component selectors, True-scale assembly, Separate tools and Cutaway. Source dimensions are kept in metres and inches as labelled. Unknown bore/diameter cells remain unknown; an unknown OD uses a length marker. Combined pipe rows stay combined. The preview does not alter the editable builder or saved assemblies. Detailed interiors are schematic, not tool-specific CAD or proof of actual tools run.

All metadata uses an authenticated Robotyx-origin bridge with exact source identities. No access token is passed into this static application. Switching source or losing context clears the private designs and risk policy. The existing rig, start menu, landing, engineering, performance and survey views retain their existing behaviour.

## Evidence

- Unit suite: 191 checks passed, including source BHA checks.
- Watch browser checks: desktop 1920×1080 and phone 390×844, source controls, stale/scope clearing, MD/TVD bands, layers, orbit and viewport fit.
- BHA source browser checks: desktop and phone, detailed bit, motor cutaway, true-scale assembly, separation, missing dimensions, read-only source and unchanged draft.
- Existing Ops landing, performance, engineering and survey-alert browser checks passed at both widths.
- Synthetic screenshots: drilling-tests/watch-zone-evidence/ and drilling-tests/bha-source-evidence/.

The release workflow builds a draft from the current complete production inventory, runs browser acceptance and verifies every overlaid payload before publishing. Unrelated files are preserved. A production change during preparation aborts release. The workflow records the previous deploy for rollback and restores it if production payload checks fail. No credentials, real well metadata, source reports or live test sends are included.

Known limits: this is source guidance and a design viewer. It is not an uncertainty-qualified collision solver, a certified actual BHA record, an operational steering solver or rig control. The companion service documents connection-mail timing and unavailable guidance.

## Current release status

Companion service PR: tittothomasai-code/the-dome#840. Drilling PR: #36. The first drilling CI run passed. The service CI jobs did not start because GitHub reports failed account payments or a spending limit. The dependent release stays unmerged and unpublished until those checks pass. No production or billing change was made.

## MWD battery option

Select an MWD tool in BHA builder. Open Details on a phone, then MWD batteries. Add each battery separately. Each has a 100-hour rating. Enter its serial, capacity already used at the baseline, and recorded powered hours since that baseline. Blank fields stay unknown. Mark unused at baseline only for a battery known to be fresh. Save a version to keep the entries; JSON, CSV and the printable report retain them. Earlier saved versions remain unchanged.

Remaining hours are an estimate: 100 × (1 − baseline capacity used / 100) − recorded powered hours. The display clamps exhausted batteries to zero and records overrun separately. Each pack is shown separately; multiple batteries do not imply additive runtime. No browser clock, drilling elapsed time or motor RPM is used as battery usage. Hours are not converted to kWh.

Well designs → MWD batteries shows available private pre-run records and an illustrative 3D pack/cutaway. The setup percentage means capacity **used**. Pre-run equivalent remaining hours are distinct from current remaining hours. Current usage and actual installation remain unknown until supported. Manufacturing date is not batch identity. A source lifetime active-time counter is not used as the powered runtime on this well. Source imagery and real battery details stay out of Git.

The battery update passed 196 unit tests locally. Desktop/phone checks cover setup battery selection, schematic cutaway, current-usage unknowns, editable serial/usage fields, a saved assembly and the authenticated Operations-context bridge. The new source metadata is additive; no database migration, mail, billing or permission change is required.

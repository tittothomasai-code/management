# Well planning polish (feat/wellplan-polish, helper G, batch6)

New module `wplanpol.js`, loaded by `wplanac.js` (no new shared-file hook). The only shared-file change is the cache tag of the existing wplanac hook in `wplan.js` (`?v=G2` → `?v=G6`).

## What changed
1. **Tab groups.** 16 tabs are in 4 groups: Plan (Proposal, Trajectory, Design, DD program, Geology), Safety (Offsets, Anti-collision, AC vs EDM, Error/SF, Error ellipses), Engineering (Casing, Beam, Physics, Environment), Cost (AFE, AFE by section). Only the tabs of the current group show. On a phone the tab area drops from 6 rows (about 260 px) to 2 rows (120 px). Tabs from other modules that are not in a group always show.
2. **Fixed tab order.** Before, the order changed with module load timing (phone and desk differed). Now it is the same everywhere.
3. **Sticky tab bar.** The tab bar stays at the top when the panel scrolls.
4. **Wide tables** scroll sideways in the panel and do not cut columns.
5. **Last tab is remembered** (localStorage `wp_view`). URL `?wplan=<tab>` opens a tab, for example `?wplan=wga`.
6. **One AFE rate set.** "Cost / AFE" is now "AFE by section". It reads and writes the same rates as the AFE tab (`GX.wpg.G.rates`), so a rig rate change in one tab changes the other. A note explains that the AFE tab also adds risk lines, so its P50 is higher.

All costs are SIM. No new engineering model.

## Sources
- Rates and AFE engine: unchanged, see docs/wplan-physics.md and docs/wellplan-ac.md.
- UI grouping follows the plan → check → engineer → cost order of a well programme (e.g. IADC Drilling Manual, 12th ed., well planning chapter; NORSOK D-010 well programme content).

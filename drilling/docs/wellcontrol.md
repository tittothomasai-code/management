# Well control (feat/wellcontrol)

Module: `wellcontrol.js`, opened with the **Well control** tool button or `/?wellcontrol=kick|kill|maasp`. Hook: one line in `ext3.js`.
All values are **SIM** (teaching model). No live data. Nothing is written to Supabase, WITSML or Adaga.

## Engines reused (no new engine)
- `wellctl.js`: kick influx, shut-in pressures, kill sheet numbers, step-down schedule.
- `fluids.js`: API RP 13D annular pressure loss → ECD; `window_()` → `GX.strat.pressureAt` (fracture gradient), SIM fallback.
- `bop.js`: read-only line-up status (HCR / choke line, closed rams) shown on the kick and kill pages.

## Kick indicators
Primary: pit gain ≥ 1.0 m³, flow out − flow in ≥ 0.1 m³/min and ≥ 10 %, flow with pumps off. Secondary: drilling break (ROP ≥ 2 × trailing mean). Shut-in pressures are stable when SICP changes < 0.35 bar/min over 2 min.
Sources: IWCF Drilling Well Control syllabus (warning signs, shut-in); IADC WellSharp; API RP 59 *Well Control Operations*.

## Kill sheet
- KMW = OMW + SIDPP ÷ (g · TVD) (rounded up 0.01 SG)
- ICP = SIDPP + SCR; FCP = SCR × KMW ÷ OMW
- Wait and Weight: one circulation, DP pressure ICP → FCP over surface-to-bit strokes, then hold FCP.
- Driller's method: circulation 1 with original mud at ICP (constant), circulation 2 ICP → FCP while kill mud fills the string, then hold FCP.
Sources: IWCF kill sheet (surface BOP, vertical well); API RP 59 §§ on Driller's and Wait-and-Weight methods; Grace, *Advanced Blowout and Well Control* (1994).

## MAASP
MAASP = (FG at shoe − MW) × g × TVD shoe. FG from the Earth model (`GX.strat.pressureAt`), else the SIM Eaton-style fallback in `fluids.js`. Source: IWCF formula sheet.

## Losses and LCM pill
Losses start when ECD at the shoe or bit exceeds the fracture gradient. Rate (SIM): radial Darcy q = 2πkhΔP ÷ (μ ln(re/rw)), k 2000 mD, h 10 m, μ 30 cP.
Class: seepage < 1.6 m³/h (10 bbl/h), partial 1.6–16 m³/h, severe > 16 m³/h, total = no returns. Pill: open hole volume (max 150 m) × 1.5, minimum 8 m³; 40 / 100 / 150 kg/m³ by class; total losses → plug.
Sources: common industry lost-circulation guidelines (e.g. SPE/IADC LC decision trees; Baroid/MI-SWACO LCM selection guides; Darcy radial flow, Lake *Petroleum Engineering Handbook* Vol. II).

## Test
`node wellcontrol_test.mjs http://localhost:8832` → 36 pass, 0 fail. Shots: `shots_live/161_wellcontrol_*`.

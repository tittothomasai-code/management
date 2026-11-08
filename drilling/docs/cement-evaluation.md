# Cement evaluation (SIM): bond log, top of cement, isolation at the shoe

Module: `cemeval.js` (helper I4, batch6, branch `feat/casing-cement2`). Button **Cement log**, URL `?demo=cemlog`, API `GX.cemeval`.
This step comes after the 9-5/8" primary cement job (`cement.js`) and before drill-out and the FIT (`fitlot.js`).
All values are **SIM** and come from the job model. This is not a measured log.

## Model chain (no new hydraulics)
1. **ECD during the job**: we sweep `cement.js` `stateAt()` over the pumped volume and keep the max ECD at the shoe.
2. **Fracture gradient at the shoe**: from `GX.strat.pressureAt()` when the strat model is loaded (shown "strat"). If not, we use `cement.js FRAC` = 1.55 SG (shown "SIM").
3. **Losses**: if the max ECD is more than the FG, we lose 0.4 m³ per 0.001 SG over FG (SIM rule, max half the slurry). The top of cement (TOC) moves down by lost volume ÷ annular capacity at the planned TOC.
4. **Standoff**: from `centralizer.js profile()` for the selected spacing (1 per 1–4 joints). Inside the previous casing we use 75 % (SIM).
5. **Mud removal**: displacement efficiency is 1.0 at standoff ≥ 67 %, 0.75–1.0 from 50 to 67 %, and 0.3–0.75 under 50 % (SIM curve, after Nelson & Guillot ch. 5: channels form on the narrow side).
6. **Bond index (BI)**: BI = efficiency × slurry factor (tail 1.0, lead 0.85 because lead slurry has a lower acoustic impedance). BI = 0 above TOC (free pipe).
7. **CBL amplitude**: A = A_free · (A_min/A_free)^BI, with A_free = 60 mV and A_min = 1.5 mV (9-5/8", 3 ft receiver). This is the inverse of BI = log(A_free/A)/log(A_free/A_min) (Pardue et al., 1963).
8. **Pseudo VDL**: straight bright stripes for free pipe (casing arrivals), weak and wavy stripes for good bond (formation arrivals). Only for display.
9. **Isolation check**: we need ≥ 30 m of continuous good bond (BI ≥ 0.8) above the shoe (NORSOK D-010: casing cement verified by a log, 30 m). If not, the panel tells you to squeeze before the FIT.

## Default case
The job ECD is 1.562 SG. With the SIM FG (1.55 SG) we lose about 4.6 m³ and the TOC is at 399 m instead of 250 m. With the strat FG (about 1.74 SG) there are no losses.
At 1 centraliser per joint the shoe has about 1290 m of good bond. At 1 per 2 or 1 per 3 joints the standoff at the bottom goes to 0 % and the bond at the shoe fails.

## Sources
- API RP 10D-2 / ISO 10427-2, *Recommended Practice for Centralizer Placement and Stop-collar Testing* (67 % standoff target).
- API TR 10TR1, *Cement Sheath Evaluation*, 2nd ed., 2008 (CBL/VDL, bond index).
- Nelson, E.B. & Guillot, D. (eds.), *Well Cementing*, 2nd ed., Schlumberger, 2006, ch. 5 (mud removal) and ch. 15 (cement job evaluation).
- Pardue, G.H., Morris, R.L., Gollwitzer, L.H., Moran, J.H., "Cement Bond Log – A Study of Cement and Casing Variables", JPT, May 1963 (SPE-453-PA).
- NORSOK D-010 rev. 5 (2021), *Well integrity in drilling and well operations*, EAC 22 casing cement.

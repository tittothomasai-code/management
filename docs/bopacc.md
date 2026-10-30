# BOP ghost opacity fix + accumulator drawdown chart (feat/bop-acc, helper B)
All data is **SIM**. Units and the volume axis (cumulative gal, as API 53 sizing uses) follow the bop.js drawdown table.

## Ghost opacity
- Each source material gets one cached clone. Opacity = original × 0.28. depthWrite is off, and arrays of materials are handled.
- BOP parts (rams, annular, plug) use renderOrder 3 while the ghost is on. The original materials and render order come back when the ghost is off.
- `BOPSIM.ghostStats()` gives the counts for tests.

## Drawdown chart
- `#bopDDc` plots pressure against cumulative volume drawn from the bottles. Boyle's law: P1·V1 = P2·V2, isothermal.
- Dashed limits: precharge + 200 (psi, API 53) (minimum final pressure, API Std 53 drawdown test) and precharge.
- The line is green when PASS and red when FAIL.

## Sources
- API Standard 53, 5th ed. (2018): accumulator drawdown test and minimum operating pressure.
- API Spec 16D: control systems for drilling well control equipment, usable volume method.
- Boyle–Mariotte law (isothermal): see any physics text, e.g. Halliday, Resnick & Walker, *Fundamentals of Physics*.

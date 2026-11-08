# Workover 2 (helper F): coiled tubing, fishing, P&A — SIM

All values are SIM teaching values. Module: `woeng2.js` (pure), panel: `wo2.js` (opened from the workover panel, "More" button).

## Coiled tubing
- Bending strain on reel/gooseneck ε = OD / (2R + OD). Low-cycle fatigue after Coffin-Manson, N ∝ ε⁻², with a derate for internal pressure (trend after Newman, "Determination of coiled tubing fatigue life", SPE 26539; Tipton, SPE 35587). SIM factors, not a qualified fatigue model.
- Buckling: sinusoidal load in a deviated well after Dawson & Paslay (1984), "Drillpipe buckling in inclined holes", JPT/SPE 11167; helical = √2 × sinusoidal (Chen, Lin & Cheatham 1990, SPE 19176). Vertical well: Lubinski (1950).
- Run-in-hole / lock-up: soft-string force model (Johancsik, Friesen & Dawson 1984, SPE 11380) with added helical contact force after Mitchell (1986, SPE 15470).
- Circulating pressure: friction from `fluids.js` gradient (API RP 13D rheology).

## Fishing
- Tool choice from fish type (overshot, spear, junk basket, magnet, mill).
- Economic fishing time: D_max = (V + C_s)/(R_f + C_f) (Keller et al., "Deciding when to fish", SPE/JPT 1973; Shute et al. 1996). Jar impulse from simple momentum, SIM.

## P&A
- Barrier rules after NORSOK D-010 rev. 5 (2021), well barrier element tables (cement plug: ≥100 m MD good cement, ≥50 m above source of inflow), and OEUK (O&GUK) "Guidelines for the abandonment of wells", Issue 7 (2022).
- Verification: tag test (weight), pressure test, inflow (negative) test.

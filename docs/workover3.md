# Workover 3: coiled tubing life, fishing, P&A balanced plug (feat/workover3, helper F)
All values are **SIM**. Metric units. Model is in `woeng3.js`, UI tabs are in `wo2.js` (ct2, fish2, plug).

## CT life (tab ct2)
- Fatigue map: damage for each segment from trips over the gooseneck and reel, plus wiper trips. A segment is retired at 80 % damage, and the tip is cut.
- Weight chart: RIH, POOH and free-hanging curves. RIH stops at helical lock-up (SIM example: about 4461 m).

## Fishing (tab fish2)
- Free point by stretch: L = E·A·ΔL / ΔF. SIM example: 2-7/8 in, 300 mm, 100 kN gives about 726 m.
- Overshot and wash pipe are picked by fish OD and hole ID. The UI shows "no overshot" when the fish is too large.

## Balanced cement plug (tab plug)
- H = Vc / (Ca + Cp). Spacer behind = spacer ahead · Cp/Ca. Displacement = Cp·(base − H) − spacer behind.
- There are 11 steps, from RIH to the tag/pressure test, with a slow pull out of the cement and WOC.
- SIM example: H 175.6 m, top 2254 m, Vc 3.20 m³, displacement 6.49 m³, 22.8 h in total.

## Sources
- Newman, K.R., SPE 26539 (1993), coiled tubing fatigue.
- Johancsik, C.A. et al., SPE 11380 (1984), torque and drag.
- Mitchell, R.F., buckling and lock-up of tubulars (SPE Drilling Engineering papers, 1980s–90s).
- Hooke's law free-point and stretch method (standard fishing practice, e.g. Kemp, *Oilwell Fishing Operations*).
- NORSOK D-010 rev. 5 (2021) and OEUK Well Decommissioning Guidelines: barrier plug length and verification.
- API RP 65-2 and common balanced-plug method (Nelson & Guillot, *Well Cementing*, 2nd ed.).

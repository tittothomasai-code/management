# Choke manifold test (helper B) — SIM

`choke.js`: schematic choke manifold (HCR, CM1–CM6, hydraulic choke A, manual choke B, gauges G1/G2), API Std 53 test sequence per valve, pressure-vs-time chart with hold band, and test record table. All SIM. Uses `bop.js` API only (`STACK`, `CRIT`, `highTarget`, `pressureTest`, `evaluate`); no change to bop.js.

- Low test 250–350 psi, hold 5 min, stable (API Std 53, 5th ed. 2018, §6.5 / table 3).
- High test: rated working pressure on the initial test; later tests to MASP + 500 psi or RWP (lesser). Downstream of the chokes: rating of that part (SIM 5000 psi).
- Each valve tested from the upstream side (direction of well flow), one at a time.
- Adjustable chokes are not full-closing devices: function test only, unless used as a positive seal (API Std 53).
- Stability rule (psi/min over the last 2 min) is a SIM rule from bop.js; on a rig the operator's chart criteria apply.
- Sources: API Standard 53, 5th edition (2018); IADC Drilling Manual, well control chapter; NORSOK D-001 choke manifold layout.

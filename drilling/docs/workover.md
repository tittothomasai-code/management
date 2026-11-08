# Workover & intervention mode (SIM)

Files: `woeng.js` (engineering + job library, pure), `workover.js` (3D scene + sequence UI), `workover_test.mjs`.
Open: start screen tile "Workover & intervention", or `?workover=<job>` (completion, perf, gravel, workover, fishing, pa, slick, wireline, ct).
All data is SIM. SIM well: 7 in casing to 2590 m, 3-1/2 in 9.3 lb/ft L-80 tubing, packer 2400 m, SSSV 300 m, perfs 2430–2452 m, Pres 26 MPa.

## Methods and sources
- Kill fluid SG = (Pres + 1.4 MPa overbalance)/(g·TVD); bullhead volume = tubing capacity to top perf +10 %. — API RP 59 (well control), IADC Well Control (workover/completion).
- Barriers, nipple down tree / nipple up BOP, test sequences. — API Std 53; NORSOK D-010 rev 5; OEUK Well Decommissioning Guidelines.
- Free point L = E·A·ΔL/ΔF; overpull limit = 90 % joint yield − string weight. — API RP 7G; standard stretch method (Bourgoyne et al., *Applied Drilling Engineering*).
- Tubing movement (piston, ballooning, temperature, buckling). — Lubinski, Althouse & Logan, JPT 1962 (SPE-178-PA).
- SSSV control pressure. — API Spec 14A / RP 14B.
- Perforating underbalance 2–7 MPa. — API RP 19B; King, Anderson & Bingham, SPE 14321 (1986).
- Gravel size 5–6 × formation D50. — Saucier, JPT 1974 (SPE-4030-PA); API RP 19C proppant/gravel testing.
- Balanced cement plug (volume, height with pipe in, spacer, displacement). — Nelson & Guillot, *Well Cementing*, 2nd ed.; NORSOK D-010 plug lengths.
- Coiled tubing pipe-light, fatigue. — ICoTA / *Coiled Tubing Technology Manual*; API RP 5C7 / RP 16ST.
- Slickline / e-line tension and cable stretch. — supplier cable specs (typical 0.108 in / 0.125 in wire, 7/32 in e-line), API RP 9B.

Simplified models for training only. Not for real well design.

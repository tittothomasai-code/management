# DD driller script (dddrv.js) — SIM
Order flow: parse -> validate -> read-back ("Copy. Slide 10 m at toolface 30 deg.") -> orient (actual TF has SIM scatter ±8 deg) -> slide/rotate in 5 m steps -> done call -> score.
Orders: `slide <L> m|ft at TF <deg>|high side|low side`, `rotate <L> m`, `survey`, `WOB <t>`, `flow <L/min>`, `pick up`. Limits (SIM): 0.5–30 m per order, WOB 0–30 t, flow 1100–2400 L/min.
Steering: dogleg = motor yield (GX.ddmotor.state().yieldDls, else SIM 4.5 deg/30m) along the toolface; rotate = SIM 0.2 deg/30m random walk. Position by minimum curvature.
Stall: from GX.ddmotor.state().stall, else SIM fallback WOB > 12.4 t. Driller stops; slide/rotate are refused until "pick up".
Score per order (0–100): −20/deg direction error vs. the no-noise expected result (max −40), −1.5/deg toolface error beyond 15 deg tolerance, −30 if DLS > 6 deg/30m. total() = mean.
Sources: ISCWSA/SPE minimum curvature; toolface steering equations (Bourgoyne et al., Applied Drilling Engineering ch. 8); three-point motor yield and slide-sheet practice (orient, slide, survey; rotate to hold) per standard PDM handbooks. All values generic, tagged SIM.

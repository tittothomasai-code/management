# BOP test SIM (bop.js, ?demo=bop), helper B
All numbers are SIM unless stated otherwise. The rules follow API Std 53 (Blowout Prevention Equipment Systems for Drilling Wells, 4th ed. 2012 and 5th ed. 2018).

## Rules used (CRIT in bop.js)
- Pressure tests: a low test first, at 250–350 psi. If the pressure goes above 350 psi, bleed it back. If it goes above 500 psi, bleed to zero and start the test again. Then a high test. Hold each test for 5 min or more with a stable pressure and no visible leak (surface stacks may use 3 min in some cases; the game uses 5 min). Test at intervals of 21 days or less.
- High test pressure: rams and valves are tested to RWP on the initial test, and later to the lesser of RWP or MASP + 500 psi. The annular is tested to the lesser of 70% of its RWP or MASP.
- "Stable" (SIM rule, because operator chart criteria are not public): the pressure drop over the last 2 min of the hold must be 3 psi/min or less (low test) and 10 psi/min or less (high test). A high test also fails if the pressure falls below 95% of the target.
- Closing times: each ram closes in 30 s or less. The annular closes in 30 s or less (45 s or less at 18-3/4" bore or more).
- Accumulator drawdown, with the pumps off: close the annular and up to 4 rams (the upper pipe ram is functioned a second time instead of the BSR), then open the HCR. The final pressure must be 200 psi or more above precharge. Wait 1 h after the system is charged before the test, and allow up to 30 min for the gas to warm up.
- Function test: every 7 days.
- Test plug: a test plug or cup tester is landed in the wellhead on drill pipe to isolate the casing below the plug.

## Model
- Accumulator: Boyle's law, isothermal. Fluid volume at pressure P = V0·(1 − Pp/P). P after U gal used = Pp·V0 / (V0·Pp/Pop + U). SIM bank: 16 × 11 gal bottles, 1000 psi precharge, 3000 psi operating.
- Closing volumes (SIM, typical 13-5/8" 10k): annular 17.98 gal, pipe ram 5.8 gal, BSR 10.6 gal. Flow rate: 45 gal/min × √(pressure factor).
- Pressure trace: the pump rate brings the pressure to the target, then there is an exponential settle of 1.2%, plus a SIM leak rate and noise, then bleed-off.

## Sources
- BSEE TCP 5010, BOP Pressure Test Frequency (2023): https://www.bsee.gov/sites/bsee.gov/files/2023-11/TCP%205010%20BOP%20Test%20Frequency%20Final%20Research%20Report_508c.pdf
- API RP/Std 53 summary: https://pdfcoffee.com/download/api-rp53-recommendations-pdf-free.html
- Function and drawdown test worksheet (Koomey): https://pdfcoffee.com/function-amp-draw-down-test-koomey-pdf-free.html
- BSEE, Status of Standard 53: https://www.bsee.gov/sites/bsee.gov/files/technical-presentations/safety/panel2-gallander.pdf

## Stage 2
- Choke manifold: 6 valves, each tested on its own in the direction of flow. Valves upstream of the chokes are tested like the rams (MASP + 500 psi, RWP on the initial test). Valves downstream of the chokes are tested to their lower rating (SIM 5000 psi). (API Std 53: test choke manifold parts to the rated pressure of each part; test valves in the direction of flow.)
- Kill line check valve: test it from the wellbore side. Pressure from the pump side opens a check valve, so the game shows FAIL with that reason (API Std 53 / BSEE TCP 5010).
- Test-due tracker: the pressure test is due 21 days after the oldest part's last pass. The function test is due 7 days after the oldest function. Dates are kept on the device only (localStorage `bopsim_v1`). The "+7 SIM days" button moves the SIM clock forward.
- Camera: flies to the stack while the panel is open (annular level for the annular, mud cross for the valves), and returns on close. On desktop the panel is a 480 px side panel.

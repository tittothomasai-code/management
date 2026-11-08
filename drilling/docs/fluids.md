# Fluids, hydraulics, pits and well control (SIM)

All values are simulated (SIM). Metric units. Modules: `fluids.js` (pure model), `wellctl.js` (pits, kick, kill), `fluidsui.js` (panel; open with `?demo=fluids` or `?fluids`).

## Stage 1 – Mud
- Fann 6-speed readings → PV = R600−R300, YP = R300−PV (API RP 13B-1/13B-2).
- Bingham plastic; power law n = 3.32 log(R600/R300) (pipe), n = 0.657 log(R100/R3) (annulus).
- Herschel-Bulkley per API RP 13D: τy = 2R3−R6, n = 3.32 log((R600−τy)/(R300−τy)), K = (R300−τy)/511ⁿ.
- Gels 10 s / 10 min, solids from retort balance (LGS/HGS), mud check flags against a target spec.
- WBM and OBM presets.

## Stage 2 – Hydraulics (API RP 13D, 6th ed. 2010 / 7th ed. 2017)
- Triplex pump output = 3·(π/4)·d²·L·eff (6"×12", 97 %).
- Wall shear rate with corrections (3n+1)/4n·8V/D (pipe), (2n+1)/3n·12V/Dh (annulus).
- HB wall shear stress τw = (4/3)ⁿτy + Kγwⁿ (pipe), (3/2)ⁿτy + Kγwⁿ (annulus).
- Generalised Re = 8ρV²/τw; laminar f = 16/Re; turbulent f = a/Re^b with a=(log n+3.93)/50, b=(1.75−log n)/7; transition blend between 3470−1370n and 4270−1370n.
- Bit Δp = ρQ²/(2Cd²A²), Cd = 0.95; HSI, jet velocity, impact force.
- ECD = MW + ΣΔp_ann/(g·TVD), with and without cuttings load.
- Cuttings slip velocity (Moore method, iterated drag), inclination factor, transport ratio, concentration.
- Surge/swab: Burkhardt (1961) clinging constant Kc≈0.45 closed-end, gel break-over; max trip speed by bisection to the pore/frac window.

## Stage 3 – Pits and trip
- Active pit volume balance, trip tank, flow-in vs flow-out, gain/loss alarms (API RP 59 / IADC well-control practice).
- Trip sheet: expected vs actual displacement per stand.

## Stage 4 – Well control
- Pore/fracture window: uses `GX.strat.pressureAt(tvd)` when present; SIM fallback Eaton (1969) fracture gradient.
- Kick: productivity-index inflow, single gas bubble, isothermal ideal gas, mud compressibility, gas migration 0.08 m/s when shut in.
- SIDPP/SICP from closed-well volume balance.
- Kill sheet (IWCF / IADC WellSharp format): KMW = OMW + SIDPP/(g·TVD) rounded up to 0.01 SG; ICP = SIDPP + SCR; FCP = SCR·KMW/OMW; strokes surface-to-bit, bit-to-shoe, bit-to-surface; MAASP.
- Driller's method (2 circulations) and Wait-and-Weight; drill-pipe pressure schedule.
- Choke: orifice model Q = Cv·a·√(Δp/ρ); auto choke is feed-forward on required casing pressure. Sim test: BHP held 38.5–40.3 MPa against 38.46 MPa pore, no second influx.
- Losses at shoe when BHP > fracture pressure.

## Sources
- API RP 13D, Rheology and Hydraulics of Oil-well Drilling Fluids (2010, 2017).
- Technical Toolboxes KB, "Drilling Fluids – Frictional Pressure Loss" (API 13D HB workflow).
- Bourgoyne et al., Applied Drilling Engineering, SPE Textbook Vol. 2 (1986), ch. 4 & 6.
- Burkhardt, J.A., "Wellbore Pressure Surges Produced by Pipe Movement", JPT 1961.
- Moore, P.L., Drilling Practices Manual (1974) – slip velocity.
- Eaton, B.A., "Fracture Gradient Prediction and Its Application", JPT 1969.
- IWCF Well Control kill sheet (surface BOP); Grace, Advanced Blowout & Well Control (1994).

## Follow-up (feat/fluids-3d)
- 3D: `fluid3d.js` adds SIM mud tanks (active pit, trip tank) beside the mud pumps; level = pit volume, colour = mud type/density, foam when gas vents.
- Choke score: time-weighted BHP margin over pore pressure; penalty below 0 (influx) and above +2.5 MPa (shoe risk), shoe breakdown time, kill losses. Grades A ≥90, B ≥75, C ≥60.
- Downhole density/rheology: ρ = ρ0·exp(γΔP − αΔT) per liquid phase (water γ 4.5e-10 /Pa, α 3.5e-4 /°C; oil γ 7.5e-10 /Pa, α 7.5e-4 /°C), solids incompressible, integrated over TVD with 0.03 °C/m gradient. Rheology factor exp(−kT(T−49 °C)+kP·ΔP).
  Sources: Sorelle, Jardiolin, Buckley & Barrios, "Mathematical Field Model Predicts Downhole Density Changes in Static Drilling Fluids", SPE 11118 (1982); Kutasov, "Empirical Correlation Determines Downhole Mud Density", OGJ (1988); Hoberock et al., "Here's how compressibility and temperature affect bottom-hole mud pressure", OGJ (1982); API RP 13D HTHP section. Coefficients are approximate (SIM).

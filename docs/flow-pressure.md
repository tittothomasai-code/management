# Flow and Pressure

Open the drilling scene. Press **F** for Flow or **P** for Pressure. Each key toggles its view independently. Press both to display both views, or tap **F+P**. Use **Show underground** to see the drill string and annulus joined at the bit. Markers travel down the string and up the annulus while the model has circulating flow. The gold connector marks the bit. When the Fluids panel is open, the F/P controls sit below its tabs so the values can be watched while operating the simulated choke and pump.

All values and overlays are **SIMULATED** training outputs. The view hides simulated readings while a WITSML session is active.

## Circuit and pressure

- Flow shows pump discharge, through-bit circulation and surface returns as separate rates. It shows annular capacity, each section's mean velocity, and nozzle area and velocity.
- Pressure shows pump discharge or standpipe pressure, casing pressure, bottom-hole pressure, the nozzle pressure drop, and the two pressure profiles. The profile chart uses true vertical depth and absolute pressure. The numbered pressure cards use gauge pressure.
- The well-control scenario uses the same pump, choke, compressible storage and hydrostatic state as the existing Well Control tab. Closing the BOP and choke traps pressure. Pump-off removes circulation losses and leaves trapped pressure in the closed well. Pumping with the return closed charges storage and does not create circulating friction.
- With an open return path, the existing hydraulics model calculates surface, drill string, nozzle and annular losses at the selected rate. Nozzle drop is separate from motor and MWD losses. For normal drilling, Flow uses the simulated rig pump state. For a running Well Control or Pits tab, it uses the well-control scenario rates and geometry.

This teaching model uses quasi-steady friction, lumped storage, piecewise hydrostatic heads and a linear measured-depth to true-vertical-depth conversion for the profile. It does not model shut-in gas migration, pump acceleration waves, elastic water hammer, transient multiphase flow, washout split-flow, or a calibrated field pressure response. The modelled annular mean is a volume-weighted circuit reading. Scene spacing and the 3D flow animation are illustrative.

## Integration and verification

Base branch is `rel/v5.12.12-witsml-dash` in `tittothomasai-code/management`. This feature supersedes the older local pressure-only module. If assembling on a candidate that already contains the old pressure-only import in `main.js`, remove that import so there is one F/P control set. Preserve the production game's other entry points.

Run `node --test pressure_test.mjs flow_pressure_test.mjs`. The six Flow/Pressure regressions cover shut-in and hold, startup, steady circulation, pump-off, closed-return charging, and the rig adapter's units. The eight original pressure-core cases are also included. The existing fluids model tests cover kick detection and the kill-method teaching scenarios.

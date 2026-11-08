# Casing, cementing, drill-out, FIT/LOT, centraliser standoff (SIM teaching models)

All values are SIM. These are teaching models, not engineered designs.

- Casing design (casing.js, v5.10): API TR 5C3 / Bulletin 5C3 pipe-body burst (Barlow, 87.5 % wall), collapse (yield/plastic/transition/elastic regimes), body yield. Load cases are simplified (gas to surface burst, full evacuation collapse, buoyed hanging weight).
- Casing run (ops3d.js, v5.11): buoyed hookload with friction, Bingham slot-flow surge/swab (API RP 13D style), fill-up every 10 joints.
- Primary cementing (cement.js 2D, cem3d.js 3D, v5.12): volume coordinate displacement, U-tube hydrostatics, free-fall, plug bump +3.5 MPa, 30 % open-hole excess, 24 m shoe track.
- WOC (fitlot.js): SIM strength curve UCS(t) = 24·(1 − e^−(t−3)/9) MPa; drill out at ≥ 3.5 MPa (≈ 500 psi, common practice).
- Drill-out + FIT/LOT (fitlot.js, v5.13): drill plugs, float collar, shoe track, float shoe, rathole, 3 m new formation. Test at 50 L/min with BOP closed. Linear pressure rise from mud/system compressibility (c = 4.5e-7 1/kPa) until leak-off; LOT then bends over, pump stop gives ISIP and decline. FIT stops at the test EMW and holds 10 min. EMW = mud SG + P/(g·TVD). Reference: IADC Drilling Manual, leak-off test procedure; SPE "Leak-off test" (PetroWiki).
- Centraliser standoff (centralizer.js, v5.14): API RP 10D-2 / ISO 10427-2 method. la = (Dhole − Dcasing)/2; Rs = 100·S/la with S = min(Sc, Ss), Ss = Sc − sag. Lateral load = buoyed span weight × sin(inc) + tension × dogleg. Sag ≈ w·L⁴/(384·E·I). Bow-spring curve is a SIM linear spring. Target Rs ≥ 67 % (API Spec 10D test value).

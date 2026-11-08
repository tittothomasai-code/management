# Safety World (v5.12.0) — SIM

Game mode on a 3D rig. Open it from the start screen tile **Safety World**, or with `?demo=safety`.
All scenarios are simulated and show the **SIM** tag. Do not use them as real site records.

## Corrective action missions
Each corrective action (CA) is a quest with 4 steps: inspect the area, apply the correct control
(guard, barrier, permit or PPE), verify the control, close the action. A wrong control is refused.
Markers on the rig: red = overdue, amber = open, green = closed. The site safety score is the mean of
the actions: closed = 1, open and not overdue = 0.5, overdue = 0. The order of controls follows the
hierarchy of controls (NIOSH / ISO 45001 clause 8.1.2): remove the hazard first, then engineering
controls (guard, barrier), then administrative controls (permit), then PPE.

## Hazard hunts
Timed hunts (easy 90 s / 3 hazards, medium 75 s / 5, hard 60 s / 6) for dropped objects, missing
handrails, open hole, H2S zone, line of fire and suspended load. Decoy spots have no hazard.
Points: 10 + seconds left / 10 for each hazard found, minus 5 for each wrong spot. Scores go to a
per-crew leaderboard on this device. Hazard types follow IADC drilling safety alerts and the
DROPS (dropped objects prevention) scheme.

## Controls
Touch/click a marker or a list button. Keyboard: arrows move focus, Enter selects, Esc goes back.
Gamepad: d-pad moves, A selects, B goes back.

## Adapter seam (per organisation)
`safety_adapter.js` holds the scenario source. Today only `simAdapter` is registered.
An adapter is `{id, source:'SIM'|'ORG', tenantId, listMissions(ctx), listHunts(ctx)}`.
`orgAdapterStub(tenantId)` is the stub for an organisation's own incidents and corrective actions;
it returns no data until logins exist. `getScenarios({tenantId})` enforces the rules: every scenario
gets a source tag; ORG scenarios are shown only for the same tenant and their tenant is forced to the
adapter's tenant; with no ORG data the SIM scenarios are the fallback. No live data, no network calls.

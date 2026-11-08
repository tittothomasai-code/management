# EDM wellhead labels (feat/edm-labels)
In EDM Site 3D each wellhead has a label (well name). Click the label or the wellhead to open a details card:
name, slot, status (Drilled if a definitive/actual survey exists, else Planned), TD MD and TVD (m), last survey station (MD, inc, azi), and the closest offset well with its separation factor (SF).
All values come from the imported EDM file and are tagged IMPORT. They are for planning only, not LIVE data.
SF note: the active game well has no position in the EDM site frame, so the card shows the closest offset SF from the site anti-collision matrix (edm AC result), not SF to the game well.
SF colours: < 1.0 stop (red), 1.0-1.5 warning (amber), per common ISCWSA practice.
Sources:
- ISCWSA, Error Model and Collision Avoidance work groups, separation factor definition: https://www.iscwsa.net/
- Landmark EDM data model (wellbore, definitive survey, design): Halliburton EDM documentation.
- three.js Vector3.project and Raycaster: https://threejs.org/docs/#api/en/core/Raycaster

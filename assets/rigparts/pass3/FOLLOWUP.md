# Pass 3 follow-up — 31 October 2026

Completed in the existing pass3 folder. The complete hand-back now contains 8 parts and 24 runtime GLBs.

- offshore_drill_floor: all three LODs; 14 x 14 m deck, 3.5 m hollow box girders, no hull or support legs; rotary, V-door, pipe ramp, stairs, rails, doghouse and all requested empty datums. The four foot datums match the unchanged pass 3 derrick after snapping the two attach_wellcentre nodes. All 9 LOD combinations have zero datum error.
- substructure_drill_floor_A: all three LODs; paint and PBR factors verified against the supplied triple_high.glb, nominal 9 x 9 m mast pattern measured from its mast__mast lower sections. Unit scale remains metres. The source deck is about 7.8 m; this component retains the requested 9 m floor height and detailed pass 3 envelope.
- frac_pump_truck_single: M and L geometry lowered by 7 mm. Decoded mesh minimum Y is now exactly 0 for all three LODs. attach_base remains [0,0,0]. The High file and the other 15 original GLBs are byte-for-byte unchanged.

All 24 files meet the LOD budgets. Compressed and decoded Khronos checks: zero errors and warnings. All 24 load in the inspection viewer; clear-bore, BOM, tangent/AO and snap checks pass.

Read manifest.json for exact positions and node-to-BOM metadata. See screenshots/offshore_floor_derrick_assembled_day.png and the night counterpart for the assembled interface. Source and the uploaded reference remain under source/ and are excluded from runtime shipping.

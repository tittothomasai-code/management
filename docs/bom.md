# Workshop BOM (bom.js, bom_data.js) — SIM
Generic, industry-standard bill of materials for the 12 workshop exploded-view models. Values are typical public
catalogue / API spec values (API 8C hoisting, API 16A BOP, API 6A wellhead, API 7-1 IBOP, API 9A wire rope, API 4F mast,
API 16C choke, API 16D control system, API RP 13C screens). All rows are tagged SIM; none is from a real rig drawing.
Hierarchy for the showroom: `RIG` > `assets[]` (topdrive, drawworks, mudpumps, bop, mast, pipehandling, mudtanks,
generators, accumulator, choke, then downhole models with group:"downhole") > `components[]` > `lines[]` {no,name,qty,spec,fn,part,ws,src}.
`line.ws`+`line.part` link to a workshop 3D part. Call `names(GX.ws.CAT)` once to fill names. Helpers: `walk(fn(asset,comp,line))`, `asset(id)`; flat `BOM[wsKey]` for bom.js.

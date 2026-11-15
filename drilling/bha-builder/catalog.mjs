// Original schematic tool profiles. Dimensions are editable; these are not tool ratings.
const rows=[
 ['pdc-bit','PDC bit','Bit',.30,6.125,0],['roller-bit','Roller-cone bit','Bit',.28,6.125,0],['core-bit','Core bit','Bit',.25,6.125,2.5],
 ['near-bit','Near-bit sub','Sub',.89,5,1.375],['motor','Mud motor','Motor',7.48,4.75,1.5],['rss','Rotary steerable tool','Motor',4,4.75,1.5],
 ['float-sub','Float valve sub','Sub',.6,4.75,1.75],['ubho','Orienting sub','Sub',.87,4.67,2.75],['pony','Pony collar','Collar',1.67,4.5625,2.625],['gap-sub','Gap sub','Sub',1.04,4.75,2.75],
 ['nmdc','Nonmagnetic drill collar','Collar',5.97,4.6875,2.6875],['mwd','MWD collar','MWD',9.37,4.75,2.6875],['mwd-probe','MWD probe','MWD',3.2,1.875,.5],
 ['gamma','Gamma tool','MWD',2,4.75,1.5],['resistivity','Resistivity tool','MWD',3,4.75,1.5],['density','Density tool','MWD',3.5,4.75,1.5],['sonic','Sonic tool','MWD',3.5,4.75,1.5],
 ['stabilizer','Spiral stabilizer','Stabilizer',1.2,6.05,2],['straight-stabilizer','Straight stabilizer','Stabilizer',1.2,6.05,2],['reamer','Roller reamer','Stabilizer',1.8,6.05,2],['hole-opener','Hole opener','Stabilizer',1.5,8.5,2],
 ['crossover','Crossover sub','Sub',.61,4.75,2.25],['safety','Safety joint','Sub',1.01,4.875,2.25],['jar','Drilling jar','Sub',5.5,4.75,2.25],['shock','Shock sub','Sub',2,4.75,2.25],
 ['collar','Drill collar','Collar',9.1,4.75,2.25],['spiral-collar','Spiral drill collar','Collar',9.1,4.75,2.25],['hwdp','Heavyweight drill pipe','Collar',9.72,4,2.75],['drill-pipe','Drill pipe','Collar',9.5,4,3.25],
 ['core-barrel','Core barrel','Collar',6,4.75,2.5],['core-ring','Core catcher ring','Sub',.16,4.75,2.5],['fishing-sub','Fishing sub','Sub',.65,4.75,2],
];
export const CATALOG=rows.map(([kind,name,type,lengthM,odIn,idIn])=>({kind,name,type,lengthM,odIn,idIn,maxDls:type==='Bit'?10:8,rigidSpanM:type==='Bit'?0:Math.min(lengthM,2),odToleranceMm:type==='Bit'?0:.5,yieldPsi:110000,toolReference:'Schematic profile; verify the actual tool',upperConnection:'',lowerConnection:''}));
export const BY_KIND=Object.fromEntries(CATALOG.map(c=>[c.kind,c]));
export const COLUMNS=[['description','Description','text'],['serial','Serial number','text'],['rihHours','RIH hours','number'],['odIn','OD (in)','dimension'],['idIn','ID (in)','dimension'],['upperConnection','UH connection','text'],['lowerConnection','DH connection','text'],['lengthM','Length (m)','number'],['upperTorque','UH torque','number'],['lowerTorque','DH torque','number']];

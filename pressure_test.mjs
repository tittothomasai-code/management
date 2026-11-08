import test from 'node:test';
import assert from 'node:assert/strict';
import {ATM_PA, annularCapacityM3, uTubeBalance, uTubeProfile} from './pressure_core.js';

test('equal-density static U-tube columns balance from shared surface boundary',()=>{
  const b=uTubeBalance({tvdM:2400,stringDensityKgM3:1250,annulusDensityKgM3:1250});
  assert.equal(b.imbalancePa,0);assert.equal(b.balanced,true);
  const p=uTubeProfile({tvdM:2400,depthsM:[0,600,1200,2400],densityKgM3:1250});
  for(const r of p.rows)assert.ok(Math.abs(r.stringAbsPa-r.annulusAbsPa)<1e-6);
});
test('unequal fluid columns require a pressure boundary difference',()=>{
  const open=uTubeBalance({tvdM:1000,stringDensityKgM3:1200,annulusDensityKgM3:1350});
  assert.equal(open.balanced,false);
  const solved=uTubeBalance({tvdM:1000,stringDensityKgM3:1200,annulusDensityKgM3:1350,
    stringBoundaryAbsPa:open.requiredStringBoundaryAbsPa});
  assert.equal(solved.balanced,true);assert.ok(Math.abs(solved.imbalancePa)<1);
});
test('circulating pressure profile joins both legs at the bit with nozzle drop',()=>{
  const p=uTubeProfile({tvdM:1800,depthsM:[0,900,1800],densityKgM3:1250,
    surfaceLossPa:20000,stringLossPa:100000,annulusLossPa:70000,bitLossPa:45000,motorLossPa:12000,mwdLossPa:4000});
  assert.equal(p.pumpDischargeAbsPa-p.pumpDischargeGaugePa,ATM_PA);
  assert.equal(p.bitAcrossPa,45000);
  assert.equal(p.bottomBhaInletAbsPa-p.bottomHoleInnerAbsPa,16000);
  assert.ok(p.rows[0].stringAbsPa>p.rows[0].annulusAbsPa);
  assert.ok(p.rows[2].stringAbsPa>p.rows[2].annulusAbsPa);
});
test('annular capacity sums casing and open-hole geometry in SI units',()=>{
  const expected=Math.PI/4*(.216**2-.127**2)*100+Math.PI/4*(.216**2-.165**2)*50;
  assert.ok(Math.abs(annularCapacityM3([{fromM:0,toM:100,holeDiameterM:.216,pipeOutsideDiameterM:.127},
    {fromM:100,toM:150,holeDiameterM:.216,pipeOutsideDiameterM:.165}])-expected)<1e-12);
  assert.throws(()=>annularCapacityM3([{fromM:0,toM:10,holeDiameterM:.1,pipeOutsideDiameterM:.12}]),/geometry/);
});
test('pump discharge includes surface and downhole losses plus applied pressure',()=>{
  const p=uTubeProfile({tvdM:100,depthsM:[0,100],densityKgM3:1200,returnBoundaryAbsPa:ATM_PA,
    appliedSurfacePa:1e6,surfaceLossPa:1e5,stringLossPa:2e5,annulusLossPa:3e5,bitLossPa:4e5});
  assert.equal(p.pumpDischargeGaugePa,2e6);
});
test('static profile has no friction loss and gauge pressure is absolute minus atmosphere',()=>{
  const p=uTubeProfile({tvdM:500,depthsM:[0,250,500],densityKgM3:1200});
  assert.equal(p.totalLoopLossPa,0);
  for(const r of p.rows)assert.equal(r.stringGaugePa,r.stringAbsPa-ATM_PA);
});
test('friction callbacks are bounded by their fluids.js segment loss totals',()=>{
  const p=uTubeProfile({tvdM:100,depthsM:[50,100],densityKgM3:1000,stringLossPa:50,annulusLossPa:70,
    stringLossAt:z=>z*20,annulusLossAt:z=>z*30});
  assert.equal(p.rows.at(-1).stringFrictionPa,50);assert.equal(p.rows.at(-1).annulusFrictionPa,70);
});
test('invalid negative pressure or density inputs are rejected',()=>{
  assert.throws(()=>uTubeProfile({tvdM:10,depthsM:[0],densityKgM3:-1}),/finite/);
  assert.throws(()=>uTubeBalance({tvdM:1,stringDensityKgM3:1000,annulusDensityKgM3:1000,stringBoundaryAbsPa:-2}),/finite/);
});

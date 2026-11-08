import test from 'node:test';
import assert from 'node:assert/strict';
import * as W from './wellctl.js';
import * as F from './fluids.js';
import {ATM_PA} from './pressure_core.js';
import {rigCircuit, wellControlCircuit, circuitModel} from './flow_pressure_model.js';

const model=s=>circuitModel(wellControlCircuit(s));
const step=(s,n)=>{for(let i=0;i<n;i++)W.step(s,1)};
const near=(a,b,tolerance=1)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} vs ${b}`);

test('shut-in builds and holds SIDPP/SICP with zero circulating losses',()=>{
  const s=W.newWC({kickType:'water',poreSG:1.10,shoeFracSG:2.1,spm:10});
  W.takeKick(s,s.omw+.10);
  step(s,40);
  W.shutIn(s);step(s,1);
  const first=s.Pdp;
  step(s,600);
  const steady=model(s);
  assert.ok(s.Pdp>first&&s.Pc>s.Pdp);
  near(s.BHP,s.pore*1000*F.G*s.w.tvd,1500);
  near(steady.profile.pumpDischargeGaugePa,s.Pdp);
  near(steady.profile.annulusSurfaceAbsPa-ATM_PA,s.Pc);
  near(steady.profile.bottomHoleOuterAbsPa-ATM_PA,s.BHP);
  assert.equal(steady.q,0);
  assert.equal(steady.returnRate,0);
  assert.equal(steady.profile.totalLoopLossPa,0);
  const [pc,pdp]=[s.Pc,s.Pdp];step(s,80);
  near(s.Pc,pc,200);near(s.Pdp,pdp,200);
});

test('start-up increases standpipe loss at the actual pump rate',()=>{
  const s=W.newWC({poreSG:1.1,spm:0});
  step(s,1);
  assert.equal(model(s).profile.pumpDischargeGaugePa,0);
  s.spm=20;step(s,1);
  const slow=model(s);
  s.spm=40;step(s,1);
  const fast=model(s);
  near(fast.q,2*slow.q,1e-12);
  near(fast.h.bit,4*slow.h.bit);
  assert.ok(fast.profile.pumpDischargeGaugePa>slow.profile.pumpDischargeGaugePa);
  near(fast.profile.pumpDischargeGaugePa,s.Pdp);
});

test('steady circulation accounts for all losses and conserves return flow',()=>{
  const s=W.newWC({poreSG:1.1,shoeFracSG:2,spm:30});
  step(s,15);const m=model(s);
  near(m.pumpRate,m.returnRate,1e-12);
  near(m.profile.pumpDischargeGaugePa,m.h.surf+m.h.string+m.h.ann+m.h.bit+m.h.motor+m.h.mwd);
  near(m.profile.bottomHoleInnerAbsPa-m.profile.bottomHoleOuterAbsPa,m.h.bit);
  near(m.h.Vn,m.q/m.nozzleArea,1e-9);
  assert.ok(m.capacity>0&&m.meanAnnularVelocity>0);
});

test('pump-off removes friction without releasing trapped shut-in pressure',()=>{
  const s=W.newWC({kickType:'water',poreSG:1.1,shoeFracSG:2,spm:25});
  step(s,1);
  assert.ok(model(s).profile.totalLoopLossPa>0);
  s.pumpsOn=false;step(s,1);
  assert.equal(model(s).profile.pumpDischargeGaugePa,0);
  W.takeKick(s,s.omw+.08);W.shutIn(s);step(s,500);
  const m=model(s);
  assert.equal(m.h.bit,0);
  assert.equal(m.h.Vn,0);
  assert.equal(m.meanAnnularVelocity,0);
  assert.ok(m.profile.pumpDischargeGaugePa>0&&m.applied>0);
});

test('a pump against closed returns charges storage without circulating through the bit',()=>{
  const s=W.newWC({poreSG:1.1,shoeFracSG:2,spm:20});
  s.mode='kill';s.bop=true;s.choke=0;
  step(s,2);
  const m=model(s);
  assert.ok(m.pumpRate>0&&m.applied>0);
  assert.equal(m.returnRate,0);assert.equal(m.q,0);assert.equal(m.profile.totalLoopLossPa,0);
});

test('the rig path uses metres once and keeps motor and MWD losses off at zero flow',()=>{
  const m=circuitModel(rigCircuit({md:5000,pos:[0,0,4800],Q:0,dpm:20,prof:{xb:30}}));
  near(m.w.md,1524);near(m.w.tvd,1463.04);
  assert.equal(m.profile.totalLoopLossPa,0);
  near(m.ann.at(-1).to,m.w.md);
});

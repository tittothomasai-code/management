import test from 'node:test';
import assert from 'node:assert/strict';
import {GammaFilter, gammaVariance, SETTINGS} from '../drilling/dd_gamma_filter.mjs';
import {TrainingGammaLog} from '../drilling/dd_gamma_log.mjs';
import * as strat from '../drilling/strat.js';
import {mulberry} from '../drilling/ddcab_core.js';
import * as dd from '../drilling/ddrun.js';

const rig = {mode:'rotate', flow:1800, wob:10, bitRpm:150, rop:11.3};
const mechanical = {...rig, referenceRop:11.3, formationRop:11.3};
const packet = (md, gamma, extra = {}) => ({sensorMd:md, bitMd:md + 6, atSec:md * 300,
  mode:'rotate', rop:12, gamma, mechanics:mechanical, ...extra});
const read = (filter, md, gamma, extra) => filter.observe(packet(md,gamma,extra), md * 300);
const pt = md => ({md, tvd:100 + md / 2, E:md * Math.sqrt(0.75), N:0});
const advance = (log, a, b, earth = strat) => log.advance(pt(a), pt(b), a / rig.rop, rig, earth);

test('seeded gamma noise is reduced on a uniform response', t => {
  const random = mulberry(20261126), filter = new GammaFilter();
  let raw = 0, fused = 0;
  for (let md = 1; md <= 400; md++) {
    const z = Math.sqrt(-2*Math.log(random())) * Math.cos(2*Math.PI*random());
    const g = 70 + Math.sqrt(gammaVariance(12,'rotate')) * z;
    const s = read(filter, md, g);
    raw += (g-70)**2; fused += (s.mean-70)**2;
  }
  const rmse = x => Math.sqrt(x / 400);
  t.diagnostic(`seed 20261126 · raw RMSE ${rmse(raw).toFixed(2)}, fused ${rmse(fused).toFixed(2)} gAPI`);
  assert.ok(rmse(fused) < 0.7 * rmse(raw));
});

test('sensor reads the drilled inclined path, at its own MD and six metres behind the bit', () => {
  const log = new TrainingGammaLog(0, 42);
  const model = {...strat, gammaAt:(_earth,tvd) => tvd >= 110 ? 115 : 25};
  for (let md=1; md<=30; md++) {
    advance(log, md-1, md, model);
    if (md <= 6) assert.equal(log.latest, null);
    else {
      const p = log.latest.packet;
      assert.equal(p.sensorMd, md-6);
      assert.equal(p.mechanics.point.tvd, pt(md-6).tvd);
      assert.equal(p.bitMd, md);
      if (md === 25) assert.ok(log.latest.mean < 50);
      if (md === 26) assert.ok(p.gamma > 80);
      if (md === 27) assert.ok(log.latest.mean > 85);
    }
    assert.ok(log.history.size <= 6);
  }
});

test('aligned drilling contrast changes uncertainty without supplying a gamma measurement', () => {
  const flat = new GammaFilter(), change = new GammaFilter();
  for (let i=1;i<5;i++) {read(flat,i,50);read(change,i,50);}
  const a=read(flat,5,null), b=read(change,5,null,{mechanics:{...mechanical, formationRop:17}});
  assert.equal(a.mean,b.mean);
  assert.ok(b.half95 > 2*a.half95);
  assert.equal(b.status,'Gamma missing');
  // Different settings with the same normalized response do not trigger a change.
  const other = new GammaFilter();
  for (let i=1;i<5;i++) read(other,i,50);
  assert.equal(read(other,5,null,{mechanics:{...mechanical,referenceRop:20,formationRop:20}}).half95,a.half95);
});

test('dropout inflates the band, invalid gamma stays raw and updates resume', () => {
  const f=new GammaFilter();
  const first=read(f,1,60), drop=read(f,2,null), invalid=read(f,3,-8);
  assert.equal(drop.mean,first.mean);assert.ok(drop.half95 > first.half95);
  assert.equal(invalid.packet.gamma,-8);assert.match(invalid.status,/Invalid gamma/);
  assert.ok(read(f,4,65).mean > 60);
  assert.equal(read(new GammaFilter(),1,null).mean,null);
});

test('isolated outliers remain visible and two consistent adjacent samples confirm a step', () => {
  const f=new GammaFilter();read(f,1,35);
  const spike=read(f,2,200);assert.equal(spike.mean,35);assert.equal(spike.packet.gamma,200);
  assert.match(spike.status,/outlier/);assert.equal(read(f,3,35).mean,35);
  read(f,4,100);assert.match(read(f,5,102).status,/step confirmed/);
});

test('reject stale, duplicate, reordered, wrong sensor reference and missing time without mutating state', () => {
  const f=new GammaFilter();read(f,10,60);
  const state={...f};
  for(const [p,now,match] of [[packet(10,1),3000,/Duplicate/],[packet(9,1),2700,/Reordered/],
    [packet(11,1),3500,/Stale/],[packet(11,1,{bitMd:11}),3300,/Invalid/],
    [packet(11,1,{atSec:NaN}),3300,/Invalid/]]) {
    assert.match(f.observe(p,now).status,match);assert.deepEqual({...f},state);
  }
});

test('connection, off-bottom, stall and mixed-mode intervals cannot update gamma', () => {
  for(const extra of [{connection:true},{onBottom:false},{stalled:true},{mode:'mixed'},{rop:NaN}]) {
    const f=new GammaFilter();read(f,1,45);
    assert.equal(read(f,2,80,extra).mean,45);
  }
  const f=new GammaFilter();read(f,1,45);
  const slide=read(f,2,48,{mode:'slide',mechanics:{...mechanical,mode:'slide',formationRop:30}});
  assert.match(slide.status,/comparison unavailable/);
  assert.ok(gammaVariance(12,'slide')>gammaVariance(12,'rotate'));
  assert.ok(gammaVariance(24,'rotate')>gammaVariance(12,'rotate'));
});

test('mixed-mode acquisition and path interruption reset the appropriate history', () => {
  const log=new TrainingGammaLog(0,23);
  advance(log,0,6.5);
  log.advance(pt(6.5),pt(7),6.5/rig.rop,{...rig,mode:'slide'},strat);
  assert.match(log.status,/Incompatible/);assert.equal(log.latest.mean,null);
  advance(log,7,9);assert.ok(Number.isFinite(log.latest.mean));
  const last=log.latest;
  advance(log,7,8);assert.equal(log.latest,last);assert.match(log.status,/reordered/);
  advance(log,15,16);assert.equal(log.latest,null);assert.match(log.status,/Missing drilled interval/);
  advance(log,16,22);assert.equal(log.latest.packet.sensorMd,16);
});

test('well load and track branch reset clear the estimator, sensor queue and RNG', () => {
  globalThis.GX={strat};
  try {
    const first=dd.load({name:'SIM well A',seed:23});
    dd.drill(first,18);assert.ok(first.gammaLog.latest);
    const second=dd.load({name:'SIM well B',seed:23});
    assert.equal(second.gammaLog.latest,null);assert.equal(second.gammaLog.history.size,0);
    dd.drill(second,18);assert.deepEqual(second.gammaLog.latest,first.gammaLog.latest);
    const branch=dd.reset({track:'sidetrack-B',plan:dd.defaultPlan()});
    assert.equal(branch.gammaLog.latest,null);assert.equal(branch.gammaLog.trace.length,0);
  } finally {delete globalThis.GX;}
});

test('logging uses independent noise and preserves trajectories, scores, instructions, ROP and clocks', () => {
  const a=dd.newRun({seed:31}), b=dd.newRun({seed:31});
  b.gammaLog.advance=()=>{};
  globalThis.GX={strat};
  try {
    dd.drill(a,75);dd.drill(b,75);
    for (const key of ['truth','surveys','set','rec','instr','hours','rop']) assert.deepEqual(a[key],b[key]);
    assert.deepEqual(dd.score(a),dd.score(b));
    assert.ok(a.gammaLog.latest.mean >= 0);
  } finally {delete globalThis.GX;}
});

test('a detector failure is confined to the log and drilling completes', t => {
  t.mock.method(console, 'warn', () => {});
  const run = dd.newRun({seed:31}), reference = dd.newRun({seed:31});
  globalThis.GX = {strat:{...strat, gammaAt:() => {throw Error('synthetic detector failure');}}};
  try {
    dd.drill(run,35);
    assert.match(run.gammaLog.status,/instrument unavailable/);
    delete globalThis.GX;
    dd.drill(reference,35);
    assert.deepEqual(run.truth,reference.truth);
    assert.equal(run.hours,reference.hours);
    assert.deepEqual(run.surveys,reference.surveys);
  } finally {delete globalThis.GX;}
});

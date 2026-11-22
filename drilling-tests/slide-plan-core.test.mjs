import {test} from 'node:test';import assert from 'node:assert/strict';
import {planNextJoint,dogleg,requiredToolface,ADVISORY_LABEL} from '../drilling/slide_plan_core.mjs';
// All values are synthetic.
const survey={md:100,inc:10,azi:90},target={md_m:130,inc_deg:16,azi_deg:90};
test('missing target, survey or bit MD returns guidance unavailable with named inputs',()=>{
  const r=planNextJoint({survey,bit_md_m:110});assert.equal(r.status,'guidance-unavailable');assert.equal(r.slide_length_m,null);assert.match(r.missing.join(';'),/Target attitude/);
  const s=planNextJoint({bit_md_m:110,target});assert.match(s.missing.join(';'),/survey/);assert.equal(r.label,ADVISORY_LABEL);});
test('target only: required DLS and toolface, no slide split, yield and joint named missing',()=>{
  const r=planNextJoint({survey,bit_md_m:110,target});assert.equal(r.status,'advisory-uncalibrated');assert.equal(r.required_dogleg_deg,6);assert.equal(r.required_dls_deg_per_30m,9);
  assert.equal(r.toolface_deg,0);assert.equal(r.toolface_reference,'gravity (high side)');assert.equal(r.slide_length_m,null);assert.match(r.missing.join(';'),/Motor yield/);assert.match(r.missing.join(';'),/joint length/);});
test('with yield and joint range the slide/rotate split is a range and sums to the joint',()=>{
  const r=planNextJoint({survey,bit_md_m:110,target,motor:{yield_deg_per_30m:12,source:'synthetic'},joint:{min_m:12,max_m:13,source:'synthetic'},limits:{max_dls_deg_per_30m:10}});
  assert.equal(r.exceeds_limit,false);assert.equal(r.exceeds_yield,false);
  assert.ok(Math.abs(r.slide_length_m.low-7.5)<.01&&Math.abs(r.slide_length_m.high-12.19)<.01,JSON.stringify(r.slide_length_m));
  assert.ok(r.rotate_length_m.low>=0&&r.rotate_length_m.high<=13);assert.equal(r.operational,false);});
test('insufficient yield slides the whole joint and is flagged',()=>{const r=planNextJoint({survey,bit_md_m:110,target,motor:{yield_deg_per_30m:5},joint:{length_m:12}});assert.equal(r.exceeds_yield,true);assert.equal(r.slide_length_m.high,12);assert.equal(r.rotate_length_m.low,0);});
test('toolface: right turn is 90, drop is 180, near-vertical uses azimuthal reference',()=>{
  {const t=requiredToolface(30,0,30,10).toolface_deg;assert.ok(t>90&&t<95,String(t));}assert.equal(requiredToolface(30,0,20,0).toolface_deg,180);
  const v=requiredToolface(1,0,5,200);assert.equal(v.reference,'azimuthal (survey north reference)');assert.ok(Math.abs(v.toolface_deg-200)<5);assert.equal(requiredToolface(0,0,5,200).toolface_deg,200);
  assert.ok(Math.abs(dogleg(10,90,16,90)-6)<1e-9);});
test('target behind the bit is refused',()=>{const r=planNextJoint({survey,bit_md_m:140,target});assert.equal(r.status,'guidance-unavailable');assert.match(r.missing.join(';'),/ahead/);});

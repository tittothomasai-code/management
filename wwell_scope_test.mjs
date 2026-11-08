import {test} from 'node:test';
import assert from 'node:assert/strict';
import {discoverWell, guardRefusal, load, makeIO, readKnownWell, WM} from './wwell.js';

const uid = 'SYNTH-ONE';
const bore = 'SYNTH-BORE';
const blocked = {result:-1,error:'upstream response refused',reason:'credential-reflection',
  xml:'fixture-refused-content'};
const record = id => `<well uid="${id}"><name>Fixture</name></well>`;
const wells = (...records) => `<wells>${records.join('')}</wells>`;

test('known well sends one exact scoped read with no global lookup', async () => {
  const calls=[];
  const found=await readKnownWell(async (...a)=>{
    calls.push(a);
    return {result:1,xml:wells(record(uid))};
  },uid);
  assert.equal(found.uid,uid);
  assert.equal(calls.length,1);
  const [op,type,query,options]=calls[0];
  assert.equal(op,'WMLS_GetFromStore');
  assert.equal(type,'well');
  assert.match(query, /<well uid="SYNTH-ONE"\/>/);
  assert.equal(options,'returnElements=id-only;maxReturnNodes=1');
  for(const xml of [wells(record('OTHER')),wells(record(uid),record('OTHER'))]) {
    await assert.rejects(readKnownWell(async()=>({xml}),uid),/exactly the requested well UID/);
  }
});

test('known well refuses the protected result without returning XML or retrying', async () => {
  let n=0;
  await assert.rejects(readKnownWell(async()=>{
    n++;
    return blocked;
  },uid),e=>e.guardRefusal && !e.message.includes('fixture-refused-content'));
  assert.equal(n,1);
});

test('folder traversal stops at the first refused child and preserves the current model', async () => {
  const before = WM.well;
  const calls=[];
  const io=makeIO(async(op,type,query)=>{
    assert.equal(op,'WMLS_GetFromStore');
    assert.match(query,/uidWell="SYNTH-ONE"/);
    calls.push(type);
    if(type==='wellbore') return {result:1,xml:`<wellbores><wellbore uid="${bore}"/></wellbores>`};
    if(type==='log') return blocked;
    assert.fail('read after guard refusal');
  });
  await assert.rejects(load(io,uid),e=>e.guardRefusal);
  assert.equal(WM.well,before);
  assert.deepEqual(calls,['wellbore','log']);
  assert.equal(guardRefusal({reason:'network'}),null);
});

test('accepted folder reads each wellbore and its scoped data', async () => {
  const calls=[];
  const io=makeIO(async(op,type,query,options)=>{
    assert.equal(op,'WMLS_GetFromStore');
    assert.match(query,/uidWell="SYNTH-ONE"/);
    calls.push([type,options]);
    if(type==='wellbore') return {xml:`<wellbores><wellbore uid="${bore}"/></wellbores>`};
    assert.match(query,/uidWellbore="SYNTH-BORE"/);
    if(type==='log' && options==='returnElements=header-only') return {xml:
      `<logs><log uid="TIME-1" uidWellbore="${bore}"><name>Real Time</name><indexType>date time</indexType></log></logs>`};
    if(type==='log') {
      assert.match(query,/uid="TIME-1"/);
      return {xml:`<logs><log uid="TIME-1" uidWellbore="${bore}"><logData><mnemonicList>TIME,ROP</mnemonicList><unitList>,m/h</unitList><data>2026-11-01T12:00:00Z,25</data></logData></log></logs>`};
    }
    return {xml:''};
  });
  const result=await discoverWell(io,uid);
  assert.deepEqual(calls.map(c=>c[0]),['wellbore','log','trajectory','mudLog','log']);
  assert.equal(result.P.wb,bore);
  assert.equal(result.P.rows[0][1],25);
});

test('folder rejects an upstream child from another scope', async () => {
  const io=makeIO(async (op,type)=>{
    if(type==='wellbore') return {xml:`<wellbores><wellbore uidWell="OTHER" uid="${bore}"/></wellbores>`};
    assert.fail('continued after mismatched identity');
  });
  await assert.rejects(discoverWell(io,uid), e=>e.closed && /outside the requested well/.test(e.message));
});

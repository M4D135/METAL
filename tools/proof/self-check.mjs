// Fast checks of the proof tools themselves, deliberately outside npm test.
import assert from 'node:assert/strict';
import {loadRealm,selfCheck,DEFAULT_ROOT,assertHostGlobalsUnchanged} from '../realm-loader.mjs';
import {hasher,stateDigest} from './digest.mjs';
import {SCENARIOS} from './scenarios.mjs';
import {replay,sameState} from './run.mjs';

const root=process.argv[2]||DEFAULT_ROOT,before=Object.getOwnPropertyDescriptors(globalThis);
const loader=selfCheck(root),options={steps:32,seed:96},plain=loadRealm({root}),counted=loadRealm({root,instrument:true});
const a=replay(plain,SCENARIOS[0],options,{timed:false}),b=replay(counted,SCENARIOS[0],options,{timed:false});
assert(sameState(a,b),'instrumentation must not alter states or final snapshots');
assert(b.counters.ground>0&&b.counters.blocked>0);assert(a.rows.every(row=>row.counters===undefined));
const changed=loadRealm({root,patches:{simulation:[['s.time+=dt;s.elapsed+=dt;','s.time+=dt;s.elapsed+=dt;p.yaw+=1e-10;']]}}),c=replay(changed,SCENARIOS[0],options,{timed:false});
assert(!sameState(a,c));assert.notEqual(a.rows[0].stateHash,c.rows[0].stateHash,'tiny Float64 divergence must be detected at the first step');assert.notEqual(a.snapshot.sha256,c.snapshot.sha256);
const plus=hasher(),minus=hasher();plus.value(0);minus.value(-0);assert.notEqual(plus.result(),minus.result(),'Float64 negative zero is preserved');
const none=hasher(),zero=hasher();none.value(undefined);zero.value(0);assert.notEqual(none.result(),zero.result(),'missing fields must not collapse into zero');
const fixture={player:{x:0},enemies:[{hp:10}],debris:[{rotation:[0,0,0]}],events:[]},initial=stateDigest(fixture);fixture.debris[0].rotation[2]=Number.EPSILON;
assert.notEqual(initial,stateDigest(fixture),'all debris rotation axes enter the state fingerprint');
assert.throws(()=>loadRealm({root,patches:{simulation:[['anchor that cannot occur','replacement']]}}),/missing or ambiguous/);
assertHostGlobalsUnchanged(before);
console.log(JSON.stringify({schema:'metal-proof-self-check-v1',loader,instrumentationStateIdentical:true,countersNonzero:true,float64TinyChangesDetected:true,negativeZeroPreserved:true,missingFieldsDistinct:true,missingPatchFailsClosed:true,globalsPreserved:true,baselineHash:a.chainHash,changedHash:c.chainHash},null,2));

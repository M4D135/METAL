// Compare a recorded profile with the durable audit baseline, without rerunning it.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const [file,referenceFile=fileURLToPath(new URL('./reference-63668ac.json',import.meta.url))]=process.argv.slice(2);
if(!file)throw new Error('Usage: node tools/proof/reference-check.mjs profile.json [reference.json]');
const profile=JSON.parse(readFileSync(file,'utf8')),reference=JSON.parse(readFileSync(referenceFile,'utf8'));
assert.equal(profile.schema,'metal-profile-steps-v1','expected a profile-steps report');
assert.equal(profile.identical,true,'profile repetitions or instrumentation diverged');
for(const key of ['scenarioVersion','digestVersion'])assert.equal(profile[key],reference[key],key+' differs');
for(const key of ['seed','dt','requestedSteps','weapon'])assert.equal(profile.method[key],reference.method[key],key+' differs');
assert(profile.scenarios.length>0,'profile is empty');
for(const scenario of profile.scenarios){
  const expected=reference.scenarios.find(item=>item.id===scenario.id);
  assert(expected,'unknown reference scenario: '+scenario.id);
  assert.equal(scenario.index,expected.index,scenario.id+' index differs');
  assert.deepEqual(scenario.options,expected.options,scenario.id+' options differ');
  assert.deepEqual(scenario.proof,expected.proof,scenario.id+' state or snapshot differs');
}
// Source and counter changes are expected for an optimization. They remain
// recorded in both files, but are not confused with gameplay-state identity.
console.log(JSON.stringify({schema:'metal-reference-check-v1',profile:file,reference:referenceFile,scenarios:profile.scenarios.map(s=>s.id),stateIdentical:true}));

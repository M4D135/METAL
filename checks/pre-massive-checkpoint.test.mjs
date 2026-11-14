import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {loadRealm} from '../tools/realm-loader.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const points=new URL('./fixtures/pre-massive-traps/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',points),'utf8'));
const G=loadRealm({root,modules:['fmath','passages','renderer','world','destruction','economy','brain','simulation']}).window;
const plain=x=>JSON.parse(JSON.stringify(x)),hash=x=>createHash('sha256').update(x).digest('hex');
for(const entry of manifest.cases){
 const bytes=gunzipSync(readFileSync(new URL(entry.id+'.json.gz',points)));
 assert.equal(hash(bytes),entry.sha256,'immutable historical fixture');
 const {scenario,seed,envelope}=JSON.parse(bytes),point=envelope.checkpoint;
 const world=()=>G.FWorld.create(seed,scenario.index,{...scenario.options,legacyTraps:true});
 test('pre-massive '+entry.id+': exact old world and entire checkpoint round-trip',()=>{
  const w=world();assert.equal(hash(JSON.stringify(w)),entry.world_sha256,'same old geometry, placements and metadata');
  const sim=G.FSimulation.create(w,{armorSystem:true});
  assert.equal(sim.restore(plain(point)),true);
  assert.deepEqual(plain(sim.snapshot()),point,'all serialized fields, not only inventory');
  sim.step(1/60,{});sim.state.events.length=0;
  const saved=plain(sim.snapshot()),again=G.FSimulation.create(world(),{armorSystem:true});
  assert.equal(again.restore(plain(saved)),true,'a resumed old world can be saved again');
  assert.deepEqual(plain(again.snapshot()),saved);
  sim.dispose();again.dispose();
 });
 test('pre-massive '+entry.id+': current worlds stay current and reject a different identity',()=>{
  const w=G.FWorld.create(seed,scenario.index,scenario.options??undefined),sim=G.FSimulation.create(w,{armorSystem:true});
  assert.ok(w.traps.length>=24,'fresh runs still receive the massive traps');
  const before=JSON.stringify(sim.snapshot());assert.equal(sim.restore(plain(point)),false);
  assert.equal(JSON.stringify(sim.snapshot()),before);
  assert.equal(sim.restore(JSON.parse(before)),true);sim.dispose();
 });
 test('pre-massive '+entry.id+': malformed old points remain rejected without mutation',()=>{
  const sim=G.FSimulation.create(world(),{armorSystem:true}),before=JSON.stringify(sim.snapshot());
  for(const corrupt of [p=>{p.fingerprint='invalid';},p=>{p.state.player.hp=1e10;},p=>{p.state.inventory.ammo[0]=-1;}]){
   const p=plain(point);corrupt(p);assert.equal(sim.restore(p),false);assert.equal(JSON.stringify(sim.snapshot()),before);
  }
  sim.dispose();
 });
}

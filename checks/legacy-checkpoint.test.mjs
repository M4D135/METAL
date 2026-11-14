// Les points de reprise écrits avant le retrait du bouclier doivent soit se
// charger sans le bouclier, soit être refusés proprement : jamais planter.
// Les fixtures sont de vrais points produits par le code de la base du lot.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const points=new URL('docs/chantier-moteur/preuves/jeu-bouclier-supprime/t3-reprises/points/',root);
const manifeste=JSON.parse(readFileSync(new URL('manifeste.json',points),'utf8'));
const plain=value=>JSON.parse(JSON.stringify(value));

function modulesGeneres(){
  const previous=globalThis.window,modules={};globalThis.window=modules;
  try{for(const name of ['fmath','renderer','world','destruction','economy','brain','simulation'])vm.runInThisContext(readFileSync(new URL(`src/${name}.js`,root),'utf8'),{filename:name+'.js'});}
  finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
  return modules;
}
const G=modulesGeneres();
function charge(nom){return JSON.parse(gunzipSync(readFileSync(new URL(nom+'.json.gz',points))).toString('utf8'));}

test('every archived pre-lot checkpoint really carried the shield before the removal',()=>{
  assert.equal(manifeste.length,3);
  for(const entry of manifeste){
    const {snapshot}=charge(entry.nom);
    assert(snapshot.state.shield&&Number.isFinite(snapshot.state.shield.energy),`${entry.nom}: the archived point must contain the old shield state`);
    assert.equal(snapshot.state.inventory.shield,true);
    assert.equal(snapshot.state.equipment.left,'shield');
    assert.equal(entry.empreinte,snapshot.fingerprint,'the manifest must describe the archived point');
  }
});

test('a pre-lot checkpoint whose world generation changed is refused cleanly and never mutates the live simulation',()=>{
  for(const entry of manifeste){
    const {world,snapshot}=charge(entry.nom);
    const sim=G.FSimulation.create(G.FWorld.create(world.seed,world.index,world.options??undefined));
    const before=JSON.stringify(sim.snapshot());
    assert.equal(sim.restore(snapshot),false,`${entry.nom}: the pre-lot world identity no longer exists`);
    assert.equal(JSON.stringify(sim.snapshot()),before,'a refused checkpoint must leave the running state untouched');
    assert.equal(sim.state.shield,undefined);assert.equal(sim.state.inventory.shield,undefined);
    assert.equal(sim.state.player.hp,100,'a refused point must not leak health either');
  }
});

test('the same pre-lot loadout still equips a fresh sector, with a free left hand and a clamped reserve',()=>{
  for(const entry of manifeste){
    const {world,loadout}=charge(entry.nom);
    assert.equal(loadout.inventory.shield,true,'the archived loadout really came from the shield era');
    assert.equal(loadout.equipment.left,'shield');
    const sim=G.FSimulation.create(G.FWorld.create(world.seed,world.index,world.options??undefined),loadout);
    assert.equal(sim.state.shield,undefined);assert.equal(sim.state.inventory.shield,undefined);
    assert.equal(sim.state.equipment.left,null,'the left hand is simply freed');
    assert(Number.isInteger(sim.state.equipment.right)&&sim.state.inventory.weapons[sim.state.equipment.right]);
    if(sim.state.armor)assert.deepEqual(plain(sim.state.armor),{points:Math.min(100,loadout.armor.points),capacity:100},'a two-hundred-point reserve is clamped, not refused');
    if(sim.state.campaign)assert.equal(sim.state.campaign.discovered.includes('shield'),false,'the stale discovery is dropped');
    assert.equal(sim.restore(sim.snapshot()),true,'the migrated loadout round-trips through a checkpoint');
  }
});

test('a pre-lot shaped payload on an unchanged world restores and simply has no shield any more',()=>{
  const world=G.FWorld.create(96,6,{campaign:true});
  const sim=G.FSimulation.create(world,{inventory:{weapons:[true,true,false,false,true],ammo:[48,0,0,0,1],shield:true},equipment:{right:0,left:'shield',shieldEnergy:88}});
  for(let step=0;step<120;step++){sim.step(1/60,{fire:step%5<2,moveY:1});sim.state.events.length=0;}
  const saved=sim.snapshot();
  assert.equal(saved.state.equipment.left,null,'the old writer could only leave the shield in the left hand');
  const legacy=plain(saved);
  legacy.state.shield={energy:41,raised:true,rechargeDelay:1.5,bashCooldown:.8,bashVisual:.2};
  legacy.state.inventory.shield=true;
  legacy.state.equipment.left='shield';
  legacy.state.campaign.discovered=[...legacy.state.campaign.discovered,'shield'];
  const resumed=G.FSimulation.create(world);
  assert.equal(resumed.restore(legacy),true,'a payload written before the removal still restores on the same world');
  assert.equal(resumed.state.shield,undefined);assert.equal(resumed.state.inventory.shield,undefined);
  assert.equal(resumed.state.equipment.left,null);
  assert.equal(resumed.state.campaign.discovered.includes('shield'),false);
  assert.equal(JSON.stringify(resumed.snapshot()),JSON.stringify(saved),'the tolerated payload lands on the exact same state');
  const heavy=G.FSimulation.create(world,{armor:{version:1,points:150}});
  assert.deepEqual(plain(heavy.state.armor),{points:100,capacity:100});
  assert.equal(heavy.restore(heavy.snapshot()),true);
});

// Exercise the real browser shell's Continue action and storage writes without
// a renderer. Simulation validation remains real; only browser/audio APIs are stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url), key = 'ferro-expedition-v2';
const sources = Object.fromEntries(['fmath', 'renderer', 'world', 'destruction', 'economy', 'brain', 'simulation', 'motion', 'actors', 'effects', 'soundscape', 'options', 'game'].map(name =>
  [name, readFileSync(new URL(`src/${name}.js`, root), 'utf8')]));
const previousStats = { time: 316, kills: 21, shots: 72, hits: 43, score: 4730 };

function world(seed, stage) {
  return {
    seed, stage, generation: 5, title: `Secteur ${stage + 1}`,
    spawn: { x: 0, z: 0, yaw: 0 }, bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    meshes: [], lights: [], colliders: [], enemies: [], pickups: [], hazards: [],
    rooms: [{ x: 0, z: 0, w: 40, d: 40, name: 'Lisière', outdoor: true }], corridors: [],
    environment: { biome: 'woodland', outdoorZones: [{ x: 0, z: 0, w: 40, d: 40 }] },
    cores: [{ id: 0, x: 6, z: 0 }, { id: 1, x: 8, z: 0 }, { id: 2, x: 10, z: 0 }],
    exit: { x: 15, z: 0 },
  };
}

function harness(saved, initial = {}, createWorld = world, runtime = {}) {
  const memory = new Map(Object.entries(initial));
  if (saved) memory.set(key, JSON.stringify(saved));
  const elements = new Map(), errors = [], simulations = [], listeners = new Map(), frames = [], sounds = [], worlds = [], brains = [], simulationOptions = [], writes = [];
  let nextFrame, now = 0;
  const noop = () => {}, draw = new Proxy({}, { get: () => noop });
  function element(id) {
    if (elements.has(id)) return elements.get(id);
    const events = new Map(), classes = new Set();
    const value = { hidden: false, textContent: '', innerHTML: '', style: {}, dataset: {}, firstChild: { textContent: '' },
      classList: { add: name => classes.add(name), remove: name => classes.delete(name),
        toggle(name, enabled) { enabled ??= !classes.has(name); enabled ? classes.add(name) : classes.delete(name); } },
      addEventListener: (name, callback) => events.set(name, callback),
      emit: (name, event = {}) => events.get(name)?.({ preventDefault: noop, ...event }),
      click: () => events.get('click')?.({ preventDefault: noop }),
      querySelector: selector => element(id + selector),
      querySelectorAll: () => [0, 1, 2].map(n => element(id + n)),
      setAttribute: noop, focus: noop, setPointerCapture: noop, getContext: () => draw, requestPointerLock() { context.document.pointerLockElement = value; },
    };
    elements.set(id, value); return value;
  }
  const context = { console: { error: (...args) => errors.push(args) }, performance: { now: () => now }, innerWidth: 1280, innerHeight: 800,
    URLSearchParams, setTimeout, clearTimeout, navigator: { maxTouchPoints: 0 }, location: { search: '' },
    matchMedia: () => ({ matches: false }), requestAnimationFrame: callback => { nextFrame = callback; }, addEventListener: (name, callback) => listeners.set(name, callback),
    document: { body: element('body'), getElementById: element, addEventListener: noop, hasFocus: () => true, exitPointerLock() { this.pointerLockElement = null; } },
    localStorage: { getItem: name => memory.get(name) ?? null, setItem: (name, value) => { const write = { name, value: String(value), mode: element('body').dataset.state || 'menu' }; runtime.beforeWrite?.(write); memory.set(name, write.value); writes.push(write); }, removeItem: name => memory.delete(name) },
    FWorld: { create: createWorld }, FAudio: { create: () => new Proxy({}, { get: (_, name) => (...args) => { runtime.audioCall?.(name,args); sounds.push({ name, args }); } }) },
    FRender: { create: () => ({ stats: { backend: 'test' }, resize: noop, setWorld: (meshes, lights) => worlds.push({ meshes, lights, initial:true }), updateWorld: (meshes, revision, lights) => worlds.push({meshes,revision,lights}), draw: (camera, meshes, effects) => frames.push({ camera, meshes, effects }) }) },
  };
  context.window = context; vm.createContext(context);
  for (const name of ['destruction', 'economy', 'simulation', 'motion', 'actors', 'effects', 'soundscape', 'options']) vm.runInContext(sources[name], context, { filename: `${name}.js` });
  if(runtime.brain){vm.runInContext(sources.brain, context, {filename:'brain.js'});const createBrain=context.FBrain.create;context.FBrain.create=options=>{const brain=createBrain(options);brains.push(brain);return brain;};}
  const create = context.FSimulation.create;
  context.FSimulation.create = (value, options) => { const sim = create(value, options); simulations.push(sim); simulationOptions.push(options); return sim; };
  vm.runInContext(sources.game, context, { filename: 'game.js' });
  assert.deepEqual(errors, [], 'Browser shell initialization must succeed');
  return { memory, element, simulations, context, frames, sounds, worlds, brains, simulationOptions, writes,
    frame: ms => { now += ms; nextFrame(now); },
    emit: (name,event={}) => listeners.get(name)?.({type:name,preventDefault:noop,...event}),
    key: (code, down = true, repeat = false) => listeners.get(down ? 'keydown' : 'keyup')?.({ code, repeat, preventDefault: noop }) };
}

function savedPoint(generation = 5) {
  const context = { window: {} }; vm.createContext(context); vm.runInContext(sources.destruction, context); vm.runInContext(sources.economy, context); vm.runInContext(sources.simulation, context);
  const sim = context.window.FSimulation.create(world(96, 2));
  sim.state.player.x = 6; sim.step(.025, {}); // Take a relay through the real interaction.
  sim.state.weapon = 1;
  assert.equal(sim.state.relays, 1);
  return { version: 2, generation, seed: 96, stage: 2, runStats: { ...previousStats }, checkpoint: sim.snapshot() };
}

function survivalWorld(seed,stage){
  return {...world(seed,stage),generation:6,walkable:[{x:0,y:0,z:0,w:40,d:40}],
    progression:{version:1,startWeapons:stage?[true,true,true]:[true,false,false],startAmmo:stage?[72,12,4]:[48,0,0],ammoCaps:[180,36,12],maxActive:8},
    shops:[{id:'workshop',name:'Atelier de test',x:-1,y:0,z:0}],
    pickups:[{id:'fracture',kind:'weapon',weapon:1,amount:8,x:3,y:0,z:0},{id:'rupture',kind:'weapon',weapon:2,amount:3,x:6,y:0,z:0}],
  };
}
const plain=value=>JSON.parse(JSON.stringify(value));

function arsenalWorld(seed,stage){
  const w=survivalWorld(seed,stage);return {...w,progression:{...w.progression,weaponSlots:4,startWeapons:[true,false,false,false],startAmmo:[48,0,0,0],ammoCaps:[180,36,12,16],startShield:false},
    pickups:[...w.pickups,{id:'grenade-launcher',kind:'weapon',weapon:3,amount:5,x:9,y:0,z:0},{id:'shield',kind:'shield',amount:1,x:12,y:0,z:0}]};
}
function collectArsenal(app){const sim=app.simulations.at(-1);for(const x of [3,6,8,9,10,12]){sim.move(sim.state.player,x-sim.state.player.x,0);app.frame(100);}return sim;}

function campaignShellWorld(seed, index, options) {
  const value = arsenalWorld(seed, options?.campaign ? index % 3 : index);
  const gear = [{index:3,key:'shield',kind:'shield',amount:1},{index:6,key:'smg',kind:'weapon',weapon:0,amount:48},{index:9,key:'shotgun',kind:'weapon',weapon:1,amount:12},{index:12,key:'grenade',kind:'weapon',weapon:3,amount:6},{index:15,key:'rocket',kind:'weapon',weapon:2,amount:4}].find(q => q.index === index);
  return options?.campaign ? { ...value, campaign: true, index, chapter: Math.floor(index / 3), chapterTitle: 'Chapitre ' + (Math.floor(index / 3) + 1),
    progression: { ...value.progression, weaponSlots: 5, startWeapons: [false, false, false, false, true], startAmmo: [0, 0, 0, 0, 1], ammoCaps: [180, 36, 12, 16, 1] },
    pickups: gear ? [{ ...gear, id: 'trophy-' + gear.key, trophyId: 'trophy-' + gear.key, x: 3, y: 0, z: 0 }] : [],
  } : value;
}
function clearShellWorld(app) {
  const sim = app.simulations.at(-1);
  for (const x of [6, 8, 10, 15]) { sim.move(sim.state.player, x - sim.state.player.x, 0); app.frame(100); }
}
function advanceShellTo(app, index) { while (app.simulations.at(-1).state.world.index < index) { clearShellWorld(app); app.element('continue').click(); } }

function bossShellWorld(seed,index,options){
  const value=campaignShellWorld(seed,index,options);if(options?.campaignVersion!==2)return value;
  return {...value,campaignVersion:2,trophies:[],pickups:[],shops:[],
    progression:{...value.progression,startShield:true},
    enemies:[{x:0,y:0,z:-10,type:3,boss:true,bossScale:2,bossKind:'colossus',bossName:'Gardien de contrôle',maxHp:600,arena:{x:0,y:0,z:-10,r:28}}]};
}

test('V2 shell starts pistol and shield, shows physical boss rewards and resumes claimed upgrades exactly once',()=>{
  const app=harness(null,{},bossShellWorld);app.element('start').click();const sim=app.simulations.at(-1),s=sim.state;
  assert.equal(s.world.campaignVersion,2);assert.equal(s.weapon,4);assert.equal(s.equipment.left,'shield');assert.equal(s.inventory.shield,true);
  assert.equal(JSON.parse(app.memory.get(key)).campaignRevision,2);assert.match(app.element('toast').textContent,/Pistolet \+ bouclier/);
  // A wounded-boss fixture isolates the real final shot, drop and shell flow.
  const boss=s.enemies[0];boss.hp=.2;s.player.pitch=Math.atan2(boss.y-(s.player.y+1.62),10);sim.fire();assert.equal(boss.hp,0);
  app.frame(100);const crate=s.loot.find(q=>q.kind==='boss');assert(crate&&crate.rewardTaken===false);assert.equal(s.inventory.weapons[1],false);
  assert.match(app.element('objective-label').textContent,/BUTIN/);
  sim.move(s.player,crate.x-s.player.x,crate.z-s.player.z);app.frame(100);assert.equal(crate.rewardTaken,true);assert.equal(s.inventory.weapons[1],true);assert.equal(s.weapon,1);
  const saved=JSON.parse(app.memory.get(key)),ranks=JSON.stringify(s.economy);assert.equal(saved.checkpoint.campaignVersion,2);assert.deepEqual(saved.checkpoint.state.campaign.claimedBossRewards,[0]);
  assert.match(app.element('encounter-name').textContent,/BUTIN DU BOSS 1/);assert.match(app.element('encounter-caption').textContent,/DOUBLE POMPE/);
  assert.equal(app.sounds.filter(q=>q.name==='weaponPickup').length,1,'The principal boss reward and its resource loot must play one fanfare');
  const resumed=harness(saved,{},bossShellWorld);resumed.element('resume-expedition').click();const restored=resumed.simulations.at(-1);
  assert.equal(restored.state.world.campaignVersion,2);assert.equal(JSON.stringify(restored.state.economy),ranks);resumed.frame(100);assert.equal(JSON.stringify(restored.state.economy),ranks);
  assert.equal(resumed.sounds.filter(q=>q.name==='weaponPickup').length,0,'Resuming a claimed reward must not replay its fanfare');
});

test('V1 continuation keeps its route, and a new expedition always selects V2 despite a cached legacy world',()=>{
  const legacy=harness(null,{},campaignShellWorld);legacy.element('start').click();const saved=JSON.parse(legacy.memory.get(key));assert.equal(saved.campaignRevision,undefined);
  const app=harness(saved,{},bossShellWorld);app.element('resume-expedition').click();assert.equal(app.simulations.at(-1).state.world.campaignVersion,undefined);assert.equal(app.simulations.at(-1).state.inventory.shield,false);
  app.element('pause-main').click();app.element('start').click();const s=app.simulations.at(-1).state;
  assert.equal(s.world.campaignVersion,2);assert.equal(s.inventory.shield,true);assert.equal(s.equipment.left,'shield');assert.equal(s.weapon,4);assert.equal(s.campaign.claimedBossRewards.length,0);
});

test('Victory fanfare begins after the result screen has stopped active gameplay voices',()=>{
  const app=harness(null,{},campaignShellWorld);app.element('start').click();app.sounds.length=0;clearShellWorld(app);
  const victory=app.sounds.findIndex(q=>q.name==='win'),stop=app.sounds.findLastIndex(q=>q.name==='setPlaying'&&q.args[0]===false);
  assert(victory>stop&&stop>=0);assert.equal(app.sounds.filter(q=>q.name==='win').length,1);assert.equal(app.element('body').dataset.state,'cleared');
});

function trophyShellWorld(seed,index,options) {
  const w=campaignShellWorld(seed,index,options),gift=w.pickups.find(q=>q.trophyId);if(!gift)return w;
  const encounterId='trial-'+gift.key,points=[-2,0,2].map(z=>({x:-13,y:0,z}));
  return {...w,shops:[],colliders:[{minX:-8,maxX:-7.5,minY:0,maxY:3,minZ:-5,maxZ:5}],
    trophies:[{id:gift.id,key:gift.key,name:gift.kind==='shield'?'Bouclier':'Mitraillette',usage:'Enchaînez les rafales et surveillez la chauffe.',pickupId:gift.id,encounterId,grace:3,x:gift.x,y:0,z:0,...(gift.kind==='shield'?{shield:true}:{weapon:gift.weapon})}],
    enemies:points.map((q,id)=>({...q,type:0,id,encounterId,wave:0,deployed:false,role:'assault'})),
    encounters:[{id:encounterId,label:'Épreuve — équipement',trigger:{x:3,y:0,z:0,w:8,d:8},maxActive:3,leashRadius:40,spawnEntries:points,waves:[{enemyIds:[0,1,2]}],requiresTrophy:gift.id}],
  };
}

test('The campaign shell advances through eighteen worlds, saves index and finishes only after world eighteen', () => {
  const app = harness(null, {}, campaignShellWorld); app.element('start').click();
  for (let index = 0; index < 18; index++) {
    const saved = JSON.parse(app.memory.get(key)), current = app.simulations.at(-1).state.world;
    assert.equal(saved.version, 3); assert.equal(saved.campaign, true);
    assert.equal(saved.index, index); assert.equal(saved.stage, index % 3);
    assert.equal(current.index, index); assert.equal(current.stage, index % 3);
    assert.equal(app.element('sector-number').textContent, 'MONDE ' + String(index + 1).padStart(2, '0') + ' / 18');
    assert.match(app.element('sector-title').textContent, new RegExp('Chapitre ' + (Math.floor(index / 3) + 1)));
    clearShellWorld(app);
    assert.equal(app.element('body').dataset.state, index === 17 ? 'complete' : 'cleared');
    if (index < 17) app.element('continue').click();
  }
  assert.equal(app.memory.has(key), false, 'Only the final world clears the finished campaign save');
  assert(app.sounds.filter(q => q.name === 'setStage').every(q => [0, 1, 2].includes(q.args[0])), 'Audio must use a base biome track, never a campaign index');
});

test('A campaign checkpoint resumes its exact world while historical saves retain the three-sector mode', () => {
  const app = harness(null, {}, campaignShellWorld); app.element('start').click();
  for (let i = 0; i < 6; i++) { clearShellWorld(app); app.element('continue').click(); }
  const saved = JSON.parse(app.memory.get(key)), resumed = harness(saved, {}, campaignShellWorld);
  resumed.element('resume-expedition').click();
  assert.equal(resumed.simulations.at(-1).state.world.index, 6);
  assert.equal(resumed.element('sector-number').textContent, 'MONDE 07 / 18');
  assert.equal(JSON.parse(resumed.memory.get(key)).version, 3);
  const legacy = harness(savedPoint()); legacy.element('resume-expedition').click();
  assert.equal(legacy.simulations.at(-1).state.world.campaign, undefined);
  assert.equal(legacy.element('sector-number').textContent, 'SECTEUR 03 / 03');
  assert.equal(JSON.parse(legacy.memory.get(key)).version, 2);
});

test('Campaign save envelopes reject mismatched biome indices and out-of-range worlds cleanly', () => {
  const app = harness(null, {}, campaignShellWorld); app.element('start').click();
  const good = JSON.parse(app.memory.get(key));
  for (const bad of [{ ...good, index: 18 }, { ...good, index: -1 }, { ...good, index: 4, stage: 2 }, { ...good, campaign: false }]) {
    const invalid = harness(bad, {}, campaignShellWorld);
    assert.equal(invalid.element('resume-expedition').hidden, true);
    invalid.element('start').click();
    assert.equal(invalid.simulations.at(-1).state.world.index, 0);
  }
});

test('The campaign pistol HUD, keyboard, wheel, touch button and left hand use the real five-slot arsenal', () => {
  const app = harness(null, {}, campaignShellWorld); app.element('start').click(); app.frame(100);
  let sim = app.simulations.at(-1);
  assert.equal(sim.state.weapon, 4); assert.equal(app.element('weapon-label').textContent, 'PISTOLET');
  assert.equal(app.element('ammo-count').textContent, '∞'); assert.equal(app.element('slot-ammo-4').textContent, '∞');
  assert.equal(app.element('arsenal-count').textContent, '1 / 5');
  for (let i = 0; i < 4; i++) assert.equal(app.element('weapon-slot-' + i).hidden, true);
  assert.equal(app.element('weapon-slot-4').hidden, false);
  app.element('world').emit('mousedown', { button: 0 });
  for (let i = 0; i < 12; i++) app.frame(100);
  app.emit('mouseup', { button: 0 });
  assert(sim.state.shots >= 3 && sim.state.shots <= 5);
  assert.equal(sim.state.inventory.ammo[4], 1);
  assert(app.sounds.some(s => s.name === 'shot' && s.args[0].weapon === 4));
  assert(app.frames.at(-1).meshes.filter(m => m.overlay).length > 25, 'The pistol must have a real detailed first-person model');
  advanceShellTo(app, 6); sim = app.simulations.at(-1);
  sim.move(sim.state.player, 3, 0); app.frame(100);
  assert.equal(sim.state.inventory.weapons[0], true); assert.equal(app.element('weapon-slot-0').hidden, false);
  app.key('Digit5'); app.key('Digit5', false); assert.equal(sim.state.weapon, 4);
  app.emit('wheel', { deltaY: 1 }); assert.equal(sim.state.weapon, 4, 'Sub-threshold wheel movement must not change weapons');
  app.emit('wheel', { deltaY: 99 }); assert.equal(sim.state.weapon, 0);
  app.element('weapon-switch').click(); assert.equal(sim.state.weapon, 4);
  app.element('weapon-slot-0').click(); assert.equal(sim.state.weapon, 0);
  app.element('left-hand-setting').value = '4'; app.element('left-hand-setting').emit('change');
  assert.equal(sim.state.equipment.left, 4); assert.equal(app.element('left-hand-stock').textContent, '∞ BALLES');
  const rightAmmo = sim.state.inventory.ammo[0];
  app.element('left-fire-button').emit('pointerdown', { pointerId: 10 });
  for (let i = 0; i < 8; i++) app.frame(100);
  app.element('left-fire-button').emit('lostpointercapture');
  assert.equal(sim.state.inventory.ammo[0], rightAmmo); assert.equal(sim.state.inventory.ammo[4], 1);
  app.key('KeyP'); app.key('KeyP', false); app.element('restart').click();
  assert.equal(app.simulations.at(-1).state.weapon, 4);
  assert.deepEqual(plain(app.simulations.at(-1).state.inventory.weapons), [false, false, false, false, true]);
});

test('Five-slot loadouts preserve exact ownership and finite pistol state across Continue and a new browser shell', () => {
  const app = harness(null, {}, campaignShellWorld); app.element('start').click();
  advanceShellTo(app, 6);
  const first = app.simulations.at(-1); first.move(first.state.player, 3, 0); app.frame(100);
  first.state.inventory.ammo[0] = 19;
  clearShellWorld(app); app.element('continue').click();
  const next = app.simulations.at(-1), saved = JSON.parse(app.memory.get(key));
  assert.equal(next.state.world.index, 7); assert.equal(next.state.inventory.weapons[4], true);
  assert.equal(next.state.inventory.ammo[0], 19); assert.equal(next.state.inventory.ammo[4], 1);
  assert.equal(saved.entryLoadout.inventory.weapons.length, 5);
  const resumed = harness(saved, {}, campaignShellWorld); resumed.element('resume-expedition').click();
  assert.deepEqual(plain(resumed.simulations.at(-1).exportLoadout()), plain(next.exportLoadout()));
  assert.equal(resumed.element('body').dataset.state, 'playing');
});

test('Campaign ammunition stays absent from the scene and pickup hint until its actual weapon is discovered', () => {
  const make = (seed, index, options) => { const w=campaignShellWorld(seed,index,options);return {...w,shops:[],pickups:[...w.pickups,{id:'locked-ammo',kind:'ammo',weapon:0,requiresWeapon:0,amount:12,x:0,y:0,z:3}]}; };
  const app = harness(null, {}, make);app.element('start').click();advanceShellTo(app,6);app.frame(100);
  const sim = app.simulations.at(-1), atCache = m => !m.overlay && Math.abs(m.p[0]) < .001 && Math.abs(m.p[2]-3) < .001;
  assert.equal(sim.state.inventory.weapons[0],false);
  assert.equal(app.frames.at(-1).meshes.some(atCache),false);
  assert.notEqual(app.element('supply-name').textContent,'BALLES');
  sim.move(sim.state.player,3,0);app.frame(100);sim.move(sim.state.player,-3,0);app.frame(100);
  assert.equal(sim.state.inventory.weapons[0],true);
  assert(app.frames.at(-1).meshes.some(atCache));
  assert.equal(app.element('supply-name').textContent,'BALLES');
  const before=sim.state.inventory.ammo[0];sim.move(sim.state.player,0,3);app.frame(100);
  assert.equal(sim.state.inventory.ammo[0],before+12);
});

test('A real trophy discovery announces once, checkpoints grace, restores quietly and releases its physical trial', () => {
  const app=harness(null,{},trophyShellWorld);app.element('start').click();advanceShellTo(app,6);
  const sim=app.simulations.at(-1);sim.move(sim.state.player,3,0);app.frame(100);
  assert.equal(sim.state.inventory.weapons[0],true);
  assert.deepEqual(plain(sim.state.campaign.discovered),['pistol','smg']);
  assert.equal(app.element('encounter-name').textContent,'Mitraillette');
  assert.match(app.element('encounter-caption').textContent,/rafales/);
  assert.equal(app.element('wave-status').dataset.state,'trophy');
  assert.equal(app.sounds.filter(q=>q.name==='trophy').length,1);
  assert.equal(app.sounds.filter(q=>q.name==='weaponPickup').length,0,'One dedicated discovery sting replaces the ordinary pickup cue');
  const saved=JSON.parse(app.memory.get(key)),trophy=saved.checkpoint.state.campaign.trophies[0];
  assert.equal(trophy.phase,'grace');assert(trophy.timer>0&&trophy.timer<=3);
  const resumed=harness(saved,{},trophyShellWorld);resumed.element('resume-expedition').click();resumed.frame(100);
  const next=resumed.simulations.at(-1);
  assert.equal(resumed.sounds.filter(q=>q.name==='trophy').length,0);
  assert.equal(next.state.inventory.ammo[0],sim.state.inventory.ammo[0]);
  assert.equal(next.state.campaign.trophies[0].phase,'grace');
  for(let i=0;i<65&&next.state.enemies.filter(e=>e.deployed).length<3;i++)resumed.frame(100);
  assert.equal(next.state.campaign.trophies[0].phase,'trial');
  assert.equal(next.state.enemies.filter(e=>e.deployed).length,3);
  assert.equal(next.state.dead,false);
  assert.equal(resumed.sounds.filter(q=>q.name==='trophy').length,0);
  assert.equal(next.state.inventory.ammo[0],sim.state.inventory.ammo[0]);
  clearShellWorld(resumed);resumed.element('continue').click();
  assert.deepEqual(plain(resumed.simulations.at(-1).exportLoadout().campaign),{version:1,discovered:['pistol','smg']});
});

test('Four real weapon pickups feed the HUD and both mouse buttons fire independently while held together',()=>{
  const app=harness(null,{},arsenalWorld);app.element('start').click();app.frame(100);
  assert.equal(app.element('arsenal-count').textContent,'1 / 4');assert.equal(app.element('weapon-slot-3').disabled,true);
  const sim=collectArsenal(app);assert.equal(app.element('arsenal-count').textContent,'4 / 4');assert.equal(sim.state.inventory.shield,true);
  app.element('weapon-slot-0').click();app.element('left-hand-setting').value='1';app.element('left-hand-setting').emit('change');
  assert.deepEqual(plain(sim.state.equipment),{right:0,left:1});assert.equal(app.element('slot-hand-1').textContent,'G');
  const before=sim.state.inventory.ammo.slice();
  app.element('world').emit('mousedown',{button:0});app.element('world').emit('mousedown',{button:2});app.frame(100);
  assert(sim.state.inventory.ammo[0]<before[0]);assert.equal(sim.state.inventory.ammo[1],before[1]-2);
  assert(app.sounds.some(q=>q.name==='shot'&&q.args[0]?.hand==='right'));assert(app.sounds.some(q=>q.name==='fracture'&&q.args[0]?.hand==='left'));
  const afterBoth=sim.state.inventory.ammo.slice();app.emit('mouseup',{button:2});for(let i=0;i<7;i++)app.frame(100);
  assert(sim.state.inventory.ammo[0]<afterBoth[0],'Releasing right mouse must leave left mouse firing');assert.equal(sim.state.inventory.ammo[1],afterBoth[1]);
  app.emit('mouseup',{button:0});const released=sim.state.inventory.ammo.slice();for(let i=0;i<3;i++)app.frame(100);assert.deepEqual(sim.state.inventory.ammo,released);
  app.element('weapon-slot-1').click();assert.deepEqual(plain(sim.state.equipment),{right:1,left:0});assert.equal(app.element('left-hand-setting').value,'0');
  const overlays=app.frames.at(-1).meshes.filter(m=>m.overlay);assert(overlays.length>50);for(const mesh of overlays)assert(mesh.p.concat(mesh.s,mesh.r).every(Number.isFinite));
});

test('Mouse and touch guard inputs raise the real translucent shield and Space bashes instead of dashing',()=>{
  const app=harness(null,{},arsenalWorld);app.element('start').click();const sim=collectArsenal(app);
  assert.equal(sim.state.equipment.left,'shield');app.element('world').emit('mousedown',{button:2});app.frame(100);
  assert.equal(sim.state.shield.raised,true);assert.equal(app.element('left-hand-status').textContent,'GARDE LEVÉE');
  const shield=app.frames.at(-1).meshes.filter(m=>m.overlay&&m.fx&&m.alpha<.4);assert(shield.length>=1,'Shield panel must enter the translucent overlay renderer');
  const charge=sim.state.shield.energy,ammo=sim.state.inventory.ammo.slice();app.key('Space');app.frame(100);app.key('Space',false);
  assert.equal(sim.state.shield.energy,charge-24);assert(sim.state.shield.bashCooldown>0);assert.equal(sim.state.player.dash,0);assert.deepEqual(sim.state.inventory.ammo,ammo);
  assert(app.sounds.some(q=>q.name==='shieldBash'));app.emit('mouseup',{button:2});app.frame(100);assert.equal(sim.state.shield.raised,false);
  app.element('left-fire-button').emit('pointerdown',{pointerId:8});app.frame(100);assert.equal(sim.state.shield.raised,true);
  app.element('left-fire-button').emit('lostpointercapture');app.frame(100);assert.equal(sim.state.shield.raised,false);
  app.element('left-hand-setting').value='none';app.element('left-hand-setting').emit('change');app.key('Space');app.frame(100);app.key('Space',false);assert(sim.state.player.dash>0);
});

test('Shield charge, both hands and fourth-calibre ammunition survive sector Continue and entry restart',()=>{
  const app=harness(null,{},arsenalWorld);app.element('start').click();const sim=collectArsenal(app);
  app.element('weapon-slot-3').click();app.key('Space');app.frame(100);app.key('Space',false);assert.equal(sim.state.shield.energy,76);
  const carried=plain(sim.exportLoadout());assert.deepEqual(carried.equipment,{right:3,left:'shield',shieldEnergy:76});
  sim.move(sim.state.player,15-sim.state.player.x,0);app.frame(100);assert.equal(app.element('body').dataset.state,'cleared');
  app.element('continue').click();const next=app.simulations.at(-1);assert.deepEqual(plain(next.exportLoadout()),carried);assert.equal(app.element('left-hand-stock').textContent,'GARDE 76 %');
  next.state.inventory.ammo[3]--;app.key('KeyP');app.key('KeyP',false);app.element('restart').click();assert.deepEqual(plain(app.simulations.at(-1).exportLoadout()),carried);
});

test('Malformed entry equipment cannot prevent resuming an otherwise valid four-weapon checkpoint',()=>{
  const app=harness(null,{},arsenalWorld);app.element('start').click();const sim=collectArsenal(app),expected=plain(sim.exportLoadout()),saved=JSON.parse(app.memory.get(key));
  for(const corrupt of [entry=>delete entry.inventory.shield,entry=>{entry.inventory.ammo[2]=null;},entry=>{entry.armor={version:1,points:201};}]){
    const value=plain(saved);corrupt(value.entryLoadout);const resumed=harness(value,{},arsenalWorld);resumed.element('resume-expedition').click();
    assert.equal(resumed.element('body').dataset.state,'playing');assert.deepEqual(plain(resumed.simulations.at(-1).exportLoadout()),expected);
  }
});

test('Physical armor pickups update the HUD, retain excess and gain capacity only from the equipped shield',()=>{
  const make=(seed,stage)=>{const w=arsenalWorld(seed,stage);return {...w,pickups:[...w.pickups,{id:'plates',kind:'armor',amount:150,x:0,y:0,z:3}]};};
  const app=harness(null,{},make);app.element('start').click();app.frame(100);const sim=app.simulations.at(-1);
  assert.equal(app.simulationOptions.at(-1).armorSystem,true,'The real shell enables consumable armor for classic saves too');
  assert.equal(app.element('armor-pool').hidden,false);assert.equal(app.element('armor-points').textContent,'0');assert.equal(app.element('armor-cap').textContent,'/ 100');
  sim.move(sim.state.player,0,3);app.frame(100);
  assert.deepEqual(plain(sim.state.armor),{points:100,capacity:100});assert.equal(sim.state.pickups.at(-1).remaining,50);
  assert.equal(app.element('supply-name').textContent,'PLAQUES D’ARMURE');
  assert.equal(app.element('armor-points').textContent,'100');assert.equal(app.element('armor-bar').style.width,'100%');assert.equal(app.element('supply-detail').textContent,'RÉSERVE AU MAXIMUM');
  assert.match(app.element('toast').textContent,/100 ARMURE/);assert.equal(app.sounds.filter(s=>s.name==='ammoPickup').length,1);
  const saved=JSON.parse(app.memory.get(key)),resumed=harness(saved,{},make);resumed.element('resume-expedition').click();resumed.frame(100);
  assert.deepEqual(plain(resumed.simulations.at(-1).state.armor),{points:100,capacity:100});assert.equal(resumed.simulations.at(-1).state.pickups.at(-1).remaining,50);
  assert.equal(resumed.sounds.filter(s=>s.name==='ammoPickup').length,0,'A restored partial pickup must not replay or refill');
  sim.move(sim.state.player,12,-3);app.frame(100);
  assert.equal(sim.state.equipment.left,'shield');assert.deepEqual(plain(sim.state.armor),{points:100,capacity:200});assert.equal(app.element('armor-cap').textContent,'/ 200');
  sim.move(sim.state.player,-12,3);app.frame(100);
  assert.equal(sim.state.armor.points,150);assert.equal(sim.state.pickups.at(-1).taken,true);assert.equal(app.element('armor-bar').style.width,'75%');
  app.element('left-hand-setting').value='none';app.element('left-hand-setting').emit('change');assert.deepEqual(plain(sim.state.armor),{points:100,capacity:100});
  app.element('left-hand-setting').value='shield';app.element('left-hand-setting').emit('change');assert.deepEqual(plain(sim.state.armor),{points:100,capacity:200});
  app.key('Space');app.frame(100);app.key('Space',false);assert.equal(sim.state.shield.energy,76);assert.equal(sim.state.armor.points,100);assert.equal(app.element('left-hand-stock').textContent,'GARDE 76 %');
});

test('The browser shell carries fractional armor through Continue, resume and entry restart without refilling',()=>{
  const make=(seed,stage)=>{const w=arsenalWorld(seed,stage);return {...w,pickups:[...w.pickups,{id:'plates',kind:'armor',amount:150,x:12,y:0,z:0}]};};
  const app=harness(null,{},make);app.element('start').click();const sim=collectArsenal(app);
  assert.deepEqual(plain(sim.state.armor),{points:150,capacity:200});sim.hurt(7.5);app.frame(100);
  assert.equal(sim.state.armor.points,147.5);const carried=plain(sim.exportLoadout());
  sim.move(sim.state.player,15-sim.state.player.x,0);app.frame(100);assert.equal(app.element('body').dataset.state,'cleared');app.element('continue').click();
  const next=app.simulations.at(-1);assert.deepEqual(plain(next.exportLoadout()),carried);assert.equal(app.element('armor-points').textContent,'148');assert.equal(app.element('armor-cap').textContent,'/ 200');
  const saved=JSON.parse(app.memory.get(key));assert.deepEqual(saved.entryLoadout.armor,{version:1,points:147.5});
  const resumed=harness(saved,{},make);resumed.element('resume-expedition').click();assert.deepEqual(plain(resumed.simulations.at(-1).exportLoadout()),carried);
  next.hurt(15);assert.equal(next.state.armor.points,142.5);app.key('KeyP');app.key('KeyP',false);app.element('restart').click();
  assert.deepEqual(plain(app.simulations.at(-1).exportLoadout()),carried,'Restart restores the original entry points, not a full reserve');
});

test('The AI menu persists the real CPU/WebNN preference, reports actual fallback and shares one brain across simulations',async()=>{
  const app=harness(null,{'ferro-settings':JSON.stringify({aiAcceleration:'cpu'})},arsenalWorld,{brain:true});
  const brain=app.brains[0];assert.equal(brain.status.mode,'cpu');assert.equal(app.simulationOptions.at(-1).brain,brain);
  app.element('intro-options').click();app.element('tab-game').click();assert.match(app.element('ai-status').textContent,/CPU/);
  const sim=app.simulations.at(-1),elapsed=sim.state.elapsed;app.element('ai-setting').value='auto';await app.element('ai-setting').emit('change');
  assert.equal(brain.status.backend,'cpu');assert.match(app.element('ai-status').textContent,/CPU/);assert.equal(sim.state.elapsed,elapsed);
  assert.equal(JSON.parse(app.memory.get('ferro-settings')).aiAcceleration,'auto');
  app.element('resume').click();app.element('start').click();assert.equal(app.brains.length,1);assert.equal(app.simulationOptions.at(-1).brain,brain);
  app.key('KeyP');app.key('KeyP',false);app.element('ai-setting').value='cpu';await app.element('ai-setting').emit('change');assert.equal(brain.status.mode,'cpu');brain.dispose();
});

test('The real arsenal HUD locks missing guns, equips found weapons across substeps and reports spent ammunition',()=>{
  const app=harness(null,{},survivalWorld);app.element('start').click();app.frame(100);
  const sim=app.simulations.at(-1);assert.equal(app.element('arsenal-count').textContent,'1 / 3');assert.equal(app.element('ammo-count').textContent,'48');
  assert.equal(app.element('weapon-slot-1').disabled,true);assert.equal(app.element('weapon-slot-2').disabled,true);
  app.key('Digit3');app.key('Digit3',false);assert.equal(sim.state.weapon,0);assert.match(app.element('toast').textContent,/arme à trouver/);
  sim.move(sim.state.player,3,0);app.frame(100);app.frame(100);
  assert.equal(sim.state.weapon,1,'Later substeps and frames must preserve automatic pickup selection');assert.equal(app.element('weapon-slot-1').disabled,false);assert.equal(app.element('ammo-count').textContent,'08');
  assert.equal(app.sounds.filter(q=>q.name==='weaponPickup').length,1);
  app.key('Enter');app.frame(100);app.key('Enter',false);app.frame(100);
  assert.equal(sim.state.inventory.ammo[1],7);assert.equal(app.element('ammo-count').textContent,'07');assert.equal(app.element('slot-ammo-1').textContent,'7');
  app.element('weapon-switch').click();assert.equal(sim.state.weapon,0,'Cycling skips the undiscovered launcher');
  for(let i=0;i<6;i++)app.frame(100); // Let the Fracture discharge recovery finish.
  app.key('KeyV');app.frame(100);app.key('KeyV',false);assert(app.sounds.some(q=>q.name==='melee'));
});

test('Physical shop UI pauses combat, purchases atomically, saves upgrades and resumes without free refill',()=>{
  const app=harness(null,{},survivalWorld);app.element('start').click();const sim=app.simulations.at(-1);
  // A funded, wounded customer fixture isolates the UI transaction; kill/drop
  // provenance and immutable transactions are exercised in progression/economy.
  sim.state.economy.credits=500;sim.state.economy.cores=2;sim.state.player.hp=63;
  app.key('KeyF');app.frame(100);app.key('KeyF',false);assert.equal(app.element('body').dataset.state,'shop');assert.equal(app.element('shop').hidden,false);
  const elapsed=sim.state.elapsed;app.frame(100);assert.equal(sim.state.elapsed,elapsed);assert.match(app.element('shop-offers').innerHTML,/buy-vitality/);
  app.element('buy-vitality').click();assert.equal(sim.state.maxHp,120);assert.equal(sim.state.player.hp,63);assert.equal(app.element('health-max').textContent,'/ 120');
  app.element('buy-capacity').click();assert.deepEqual(plain(sim.ammoCaps),[225,45,15]);assert.equal(sim.state.inventory.ammo[0],48);
  app.element('buy-repair').click();assert.equal(sim.state.player.hp,88);app.element('buy-ammo0').click();assert.equal(sim.state.inventory.ammo[0],72);assert.equal(sim.state.economy.credits,268);
  const saved=JSON.parse(app.memory.get(key)),restored=harness(saved,{},survivalWorld);restored.element('resume-expedition').click();const resumed=restored.simulations.at(-1);
  assert.deepEqual(plain(resumed.exportLoadout()),plain(sim.exportLoadout()));assert.equal(resumed.state.player.hp,88);assert.equal(restored.element('wallet-credits').textContent,'268');
  app.element('shop-close').click();assert.equal(app.element('body').dataset.state,'playing');app.frame(100);assert(sim.state.elapsed>elapsed);
  app.key('KeyP');app.key('KeyP',false);app.element('restart').click();const restarted=app.simulations.at(-1);
  assert.equal(restarted.state.economy.credits,0);assert.equal(restarted.state.maxHp,100);assert.deepEqual(plain(restarted.exportInventory()),{weapons:[true,false,false],ammo:[48,0,0]},'A sector restart restores its entry equipment rather than farming purchased stock');
});

test('Completing a sector transfers exact ammunition, ownership, credits and upgrades through the browser Continue action',()=>{
  const app=harness(null,{},survivalWorld);app.element('start').click();const sim=app.simulations.at(-1);sim.state.economy.credits=300;
  app.key('KeyF');app.frame(100);app.key('KeyF',false);app.element('buy-capacity').click();app.element('shop-close').click();
  for(const x of [3,6,8,10]){sim.move(sim.state.player,x-sim.state.player.x,0);app.frame(100);}
  app.key('Enter');app.frame(100);app.key('Enter',false);app.frame(100);
  const carried=plain(sim.exportLoadout());assert.equal(carried.inventory.ammo[2],2);
  sim.move(sim.state.player,15-sim.state.player.x,0);app.frame(100);assert.equal(app.element('body').dataset.state,'cleared');
  app.element('continue').click();const next=app.simulations.at(-1);assert.equal(app.element('body').dataset.stage,'2');assert.deepEqual(plain(next.exportLoadout()),carried);
  const entry=JSON.parse(app.memory.get(key)).entryLoadout;assert.deepEqual(entry,carried);
  next.state.inventory.ammo[0]--;app.key('KeyP');app.key('KeyP',false);app.element('restart').click();assert.deepEqual(plain(app.simulations.at(-1).exportLoadout()),carried);
});

test('Reserved enemies remain absent from character geometry and animation until physically deployed',()=>{
  const make=(seed,stage)=>({...survivalWorld(seed,stage),enemies:[{x:0,y:0,z:-8,type:2,deployed:false}],encounters:[{id:'future',trigger:{x:14,y:0,z:14,w:3,d:3},maxActive:4,spawnEntries:[{x:0,y:0,z:-8}],waves:[{enemyIds:[0]}]}]});
  const app=harness(null,{},make),build=app.context.FActors.build,drawn=[];app.context.FActors.build=(enemy,options)=>{drawn.push(enemy.id);return build(enemy,options);};
  app.element('start').click();for(let i=0;i<3;i++)app.frame(100);
  assert.equal(app.simulations.at(-1).state.enemies[0].deployed,false);assert.deepEqual(drawn,[]);
});

test('Continue restores a current-generation checkpoint at its relay', () => {
  const saved = savedPoint(), app = harness(saved);
  assert.equal(app.element('resume-expedition').hidden, false);
  app.element('resume-expedition').click();
  const state = app.simulations.at(-1).state;
  assert.equal(app.element('body').dataset.state, 'playing');
  assert.equal(app.element('body').dataset.stage, '3');
  assert.equal(state.relays, 1);
  assert.equal(state.player.x, 6);
  assert.equal(state.weapon, 1);
  assert.equal(Number(app.element('score').textContent), previousStats.score + saved.checkpoint.state.score);
  assert.equal(app.memory.get(key + '-before-ascension'), undefined);
});

test('A real fall below a terrace opens the death screen and Continue restores the safe checkpoint', () => {
  const make = (seed, stage) => ({
    ...arsenalWorld(seed, stage), spawn: { x: 0, y: 6.4, z: 0, yaw: 0 },
    walkable: [{ x: 0, y: 6.4, z: 0, w: 4, d: 4 }, { x: 0, y: -.25, z: 0, w: 40, d: 40, fallback: true, substrate: true }],
    pickups: [], cores: [{ id: 0, x: 10, y: 6.4, z: 10 }, { id: 1, x: 12, y: 6.4, z: 10 }, { id: 2, x: 14, y: 6.4, z: 10 }],
  });
  const app = harness(null, {}, make); app.element('start').click();
  const sim = app.simulations.at(-1), saved = app.memory.get(key), before = JSON.parse(saved).checkpoint;
  sim.move(sim.state.player, 4, 0);
  assert.equal(sim.state.player.airborne, true, 'Leaving the physical terrace must start a real fall');
  for (let i = 0; i < 30 && app.element('body').dataset.state === 'playing'; i++) app.frame(100);
  assert.equal(sim.state.dead, true);
  assert.equal(sim.state.player.hp, 0);
  assert.equal(app.element('body').dataset.state, 'dead');
  assert.equal(app.element('result').hidden, false);
  assert.match(app.element('result-title').textContent, /Chute fatale/);
  assert.match(app.element('continue').innerHTML, /Reprendre au point de reprise/);
  assert.equal(app.sounds.filter(q => q.name === 'dead').length, 1);
  assert.equal(app.memory.get(key), saved, 'The fatal position must not replace the last safe checkpoint');
  const elapsed = sim.state.elapsed;
  app.frame(100); assert.equal(sim.state.elapsed, elapsed, 'The death screen must stop gameplay');
  app.element('continue').click();
  const restored = app.simulations.at(-1).state;
  assert.equal(app.element('body').dataset.state, 'playing');
  assert.equal(restored.dead, false);
  assert.equal(restored.player.hp, before.state.player.hp);
  for (const axis of ['x', 'y', 'z']) assert.equal(restored.player[axis], before.state.player[axis]);
  for (let i = 0; i < 20; i++) app.frame(100);
  assert.equal(restored.dead, false, 'The restored point must remain playable without a death loop');
  assert.equal(app.memory.get(key), saved);
});

test('Collecting a relay in flight cannot overwrite a safe checkpoint with a fatal fall', () => {
  const make = (seed, stage) => ({
    ...arsenalWorld(seed, stage), spawn: { x: 0, y: 3.2, z: 0, yaw: 0 },
    walkable: [{ x: 0, y: 3.2, z: 0, w: 4, d: 4 }, { x: 0, y: -.25, z: 0, w: 40, d: 40, fallback: true, substrate: true }],
    pickups: [], cores: [{ id: 0, x: 2.1, y: 3.2, z: 0 }, { id: 1, x: 12, y: 3.2, z: 10 }, { id: 2, x: 14, y: 3.2, z: 10 }],
  });
  const app = harness(null, {}, make); app.element('start').click();
  const sim = app.simulations.at(-1), saved = app.memory.get(key);
  sim.move(sim.state.player, 4, 0); app.frame(100);
  assert.equal(sim.state.player.airborne, true); assert.equal(sim.state.relays, 1);
  assert.equal(app.memory.get(key), saved, 'An in-flight reward must wait for a safe landing before saving');
  for (let i = 0; i < 20 && !sim.state.dead; i++) app.frame(100);
  assert.equal(sim.state.dead, true); assert.equal(app.memory.get(key), saved);
  app.element('continue').click();
  const restored = app.simulations.at(-1).state;
  assert.equal(restored.relays, 0); assert.equal(restored.player.y, 3.2);
  for (let i = 0; i < 20; i++) app.frame(100);
  assert.equal(restored.dead, false);
});

for (const generation of [4, 3, undefined]) test(`Continue migrates generation ${generation ?? 'legacy'} to the same sector without losing prior-sector totals`, () => {
  const saved = savedPoint(generation); if (generation === undefined) delete saved.generation;
  const app = harness(saved), original = app.memory.get(key);
  app.element('resume-expedition').click();
  const next = JSON.parse(app.memory.get(key)), state = app.simulations.at(-1).state;
  assert.equal(app.element('body').dataset.state, 'playing');
  assert.equal(next.stage, 2); assert.equal(next.seed, 96); assert.equal(next.generation, 5);
  assert.deepEqual(next.runStats, previousStats);
  assert.equal(state.relays, 0); assert.equal(state.player.x, 0); assert.equal(state.weapon, 1);
  assert.equal(app.memory.get(key + '-before-ascension'), original);
  assert.match(app.element('toast').textContent, /même secteur/);
  assert.equal(app.simulations.at(-1).restore(next.checkpoint), true, 'New stored point must be usable');
});

test('An invalid snapshot restarts its sector and preserves the first migration backup', () => {
  const saved = savedPoint(); saved.checkpoint.fingerprint = 'incompatible-world';
  const backup = '{"previous":"original untouched save"}', app = harness(saved, { [key + '-before-ascension']: backup, [key + '-before-horizons']: 'older backup', [key + '-refuse']: 'previous refused point' });
  app.element('resume-expedition').click();
  const next = JSON.parse(app.memory.get(key));
  assert.equal(next.stage, 2); assert.deepEqual(next.runStats, previousStats);
  assert.equal(next.checkpoint.state.relays, 0);
  assert.equal(app.memory.get(key + '-before-ascension'), backup);
  assert.equal(app.memory.get(key + '-before-horizons'), 'older backup');
  assert.equal(app.memory.get(key + '-refuse'), JSON.stringify(saved), 'the replaceable slot keeps the latest rejected point even when the first migration backup already exists');
  const backupWrite = app.writes.findIndex(write => write.name === key + '-refuse'), activeWrite = app.writes.findIndex(write => write.name === key);
  assert(backupWrite >= 0 && activeWrite > backupWrite, 'the refused point must be stored before replacing the active checkpoint');
  assert.equal(app.writes[activeWrite].mode, 'playing', 'the fallback must launch successfully before saving its replacement');
  assert.match(app.element('toast').textContent, /illisible/);
});

function saveWithEntry(campaign = false, legacy = false, revision = 1) {
  const factory = campaign ? revision === 2 ? bossShellWorld : campaignShellWorld : arsenalWorld, base = harness(null, {}, factory), index = campaign ? 9 : 2;
  const w = factory(96, index, campaign ? { campaign: true, campaignVersion: revision } : undefined), equipment = { right: 1, left: 'shield', shieldEnergy: 100 };
  const inventory = { weapons: campaign ? [true,true,true,true,true] : [true,true,true,true], ammo: campaign ? [77,9,3,4,1] : [77,9,3,4], shield: true };
  const entry = { inventory, equipment, armor: { version: 1, points: 127.5 }, economy: { ...base.context.FEconomy.fresh(), credits: 237, cores: 3 },
    ...(campaign ? { campaign: { version: revision, discovered: ['pistol','shield','smg','shotgun','grenade','rocket'], ...(revision === 2 ? { claimedBossRewards: [0,1] } : {}) } } : {}) };
  if (revision === 2) for (const reward of entry.campaign.claimedBossRewards) entry.economy = base.context.FEconomy.grantBossReward(entry.economy, reward);
  if (legacy) { entry.inventory = { weapons: [true,true,true], ammo: [77,9,3] }; delete entry.equipment; delete entry.armor; delete entry.economy; }
  const sim = base.context.FSimulation.create(w, { ...entry, armorSystem: true }), expected = plain(sim.exportLoadout());
  sim.state.player.x = 6; sim.step(.025, {}); sim.state.player.hp = 63;
  const saved = { version: campaign ? 3 : 2, generation: w.generation, seed: 96, stage: w.stage, runStats: { ...previousStats }, checkpoint: sim.snapshot(),
    ...(campaign ? { campaign: true, index, ...(revision === 2 ? { campaignRevision: 2 } : {}) } : {}), ...(legacy ? { entryInventory: entry.inventory } : { entryLoadout: expected }) };
  return { saved, expected, factory };
}

for (const variant of ['classic','campaign','campaign-v2','legacy']) test(`LOAD-01: an unrecoverable ${variant} point restarts with its exact entry equipment`, async () => {
  const { saved, expected, factory } = saveWithEntry(variant.startsWith('campaign'), variant === 'legacy', variant === 'campaign-v2' ? 2 : 1); saved.checkpoint.fingerprint = 'refused-non-rubble-state';
  const app = harness(saved, {}, factory); await app.element('resume-expedition').click();
  assert.equal(app.element('body').dataset.state, 'playing'); assert.deepEqual(plain(app.simulations.at(-1).exportLoadout()), expected);
  const next = JSON.parse(app.memory.get(key)); assert.deepEqual(next.entryLoadout, expected); assert.deepEqual(next.runStats, previousStats); assert.equal(next.checkpoint.state.relays, 0);
  assert.equal(app.memory.get(key + '-refuse'), JSON.stringify(saved)); assert(app.simulations.at(-1).restore(next.checkpoint));
});

for (const fault of ['bad-size','missing-version']) test(`LOAD-01: a rubble-only ${fault} refusal preserves progression and destruction through a copied legacy checkpoint`, async () => {
  const factory=(seed,stage)=>({...demolitionWorld(seed,stage),progression:{...arsenalWorld(seed,stage).progression,startWeapons:[true,true,true,true],startAmmo:[77,9,3,4]}});
  const original = harness(null, {}, factory); original.element('start').click(); const sim = original.simulations.at(-1);
  for (let i = 0; i < 300; i++) { sim.step(1 / 60, i === 0 ? { weapon: 2, fire: true } : {}); sim.state.events.length = 0; }
  sim.state.player.x = 6; sim.step(.025, {}); sim.state.player.hp = 61;
  const saved = JSON.parse(original.memory.get(key)); saved.checkpoint = sim.snapshot(); assert(saved.checkpoint.state.rubble.length > 0); assert.equal(saved.checkpoint.state.relays, 1);
  if (fault === 'bad-size') saved.checkpoint.state.rubble[0].size[0] = -1; else delete saved.checkpoint.rubbleVersion;
  const raw = JSON.stringify(saved), backup = 'first migration backup', app = harness(saved, { [key + '-before-ascension']: backup }, factory);
  await app.element('resume-expedition').click(); const restored = app.simulations.at(-1), next = JSON.parse(app.memory.get(key));
  assert.equal(app.element('body').dataset.state, 'playing'); assert.equal(restored.state.player.x, 6); assert.equal(restored.state.player.hp, 61); assert.equal(restored.state.relays, 1);
  assert.deepEqual(plain(restored.exportLoadout()), plain(sim.exportLoadout())); assert.equal(restored.state.debris.filter(q => q.structural).length, 0);
  assert.deepEqual(next.checkpoint.destruction, plain(saved.checkpoint.destruction)); assert.equal(next.checkpoint.rubbleVersion, 1); assert.deepEqual(next.checkpoint.state.rubble, []);
  assert.equal(JSON.stringify(saved), raw, 'repair cannot mutate the rejected source object'); assert.equal(app.memory.get(key + '-refuse'), raw); assert.equal(app.memory.get(key + '-before-ascension'), backup);
  assert.equal(app.simulations.length, 2, 'retry the candidate restore without regenerating the world'); assert.match(app.element('toast').textContent, /débris/);
  assert.equal(app.writes.find(write => write.name === key).mode, 'playing'); assert(restored.restore(next.checkpoint));
});

test('LOAD-01: a failed fallback launch never replaces the active rejected checkpoint', async () => {
  const { saved, factory } = saveWithEntry(true); saved.checkpoint.fingerprint = 'refused'; const raw = JSON.stringify(saved);
  const app = harness(saved, {}, factory, { audioCall(name, args) { if (name === 'setPlaying' && args[0]) throw new Error('launch interrupted'); } });
  await assert.rejects(app.element('resume-expedition').click(), /launch interrupted/);
  assert.equal(app.memory.get(key), raw); assert.equal(app.memory.get(key + '-refuse'), raw); assert.equal(app.writes.filter(write => write.name === key).length, 0);
});

test('LOAD-01: a failed refused-slot write cannot erase the old active point on a later checkpoint', async () => {
  const { saved, factory } = saveWithEntry(false); saved.checkpoint.fingerprint = 'refused'; const raw = JSON.stringify(saved); let blockBackup = true;
  const app = harness(saved, {}, factory, { beforeWrite(write) { if (blockBackup && write.name === key + '-refuse') throw new Error('storage unavailable'); } });
  await app.element('resume-expedition').click(); assert.equal(app.element('body').dataset.state, 'playing'); assert.equal(app.memory.get(key), raw);
  const sim = app.simulations.at(-1); sim.state.player.x = 6; app.frame(100); assert.equal(app.memory.get(key), raw, 'a later automatic checkpoint still has to preserve the rejected source first');
  blockBackup = false; sim.state.player.x = 8; app.frame(100);
  assert.equal(app.memory.get(key + '-refuse'), raw); assert.notEqual(app.memory.get(key), raw); assert.equal(JSON.parse(app.memory.get(key)).checkpoint.state.relays, 2);
  const names = app.writes.filter(write => write.name === key || write.name === key + '-refuse').map(write => write.name); assert.deepEqual(names, [key + '-refuse', key]);
});

function generatedModules() {
  const previous = globalThis.window, modules = {}; globalThis.window = modules;
  try { for (const name of ['fmath','renderer','world','destruction','economy','brain','simulation']) vm.runInThisContext(sources[name], { filename: name + '.js' }); }
  finally { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; }
  return modules;
}

for (const campaign of [false,true]) test(`LOAD-01: generated ${campaign ? 'c:9' : 'l:0'} rubble restores exactly after three real rocket breaches`, () => {
  const G = generatedModules(), w = G.FWorld.create(96, campaign ? 9 : 0, campaign ? { campaign: true, campaignVersion: 2 } : undefined);
  const options = () => ({ brain: G.FBrain.create({ mode: 'cpu' }), armorSystem: true,
    inventory: { weapons: campaign ? [true,true,true,true,true] : [true,true,true,true], ammo: campaign ? [180,36,12,16,1] : [180,36,12,16], shield: false },
    ...(campaign ? { campaign: { version: 2, discovered: ['pistol','smg','shotgun','grenade','rocket'], claimedBossRewards: [] }, equipment: { right: 2, left: null, shieldEnergy: 100 } } : {}) });
  const create = () => G.FSimulation.create(w, options()), probe = create(), walls = [];
  for (const group of w.destructibles.filter(q => q.kind === 'wall' && q.colliders.length)) {
    const b = group.bounds, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2, thinX = b.maxX - b.minX < b.maxZ - b.minZ;
    for (const side of [-1,1]) {
      const nx = thinX ? side : 0, nz = thinX ? 0 : side, x = cx + nx * 7, z = cz + nz * 7, y = probe.ground(x,z);
      if (!Number.isFinite(y) || Math.abs(y - b.minY) > .1 || probe.blocked(x,z,.28)) continue;
      const hit = probe.ray([x,y+1.62,z],[-nx,0,-nz],9); if (hit < 6 || hit > 7.4) continue;
      walls.push({ x,y,z,yaw:Math.atan2(-nx,nz),pitch:0 }); break;
    }
  }
  let checked = 0;
  for (const wall of walls) {
    const sim = create(); Object.assign(sim.state.player,wall);
    for (let i = 0; i < 300; i++) { sim.step(1/60,i === 0 ? { weapon:2,fire:true } : {}); sim.state.events.length = 0; }
    if (sim.state.dead || !sim.state.debris.some(q => q.structural)) { sim.dispose(); continue; }
    const saved = JSON.stringify(sim.snapshot()), restored = create(); assert.equal(JSON.parse(saved).rubbleVersion,1);
    assert.equal(restored.restore(JSON.parse(saved),{recover:false}),true,`breach ${checked+1} rejects a snapshot produced by real physics`);
    assert.equal(JSON.stringify(restored.snapshot()),saved,'no resting piece is displaced and every serialized gameplay field is retained');
    sim.dispose(); restored.dispose(); if (++checked === 3) break;
  }
  probe.dispose(); assert.equal(checked,3,'three live generated-world breaches must be exercised');
});

function mechanicalWorld(seed, stage) {
  const value = world(seed, stage);
  value.walkable = [{ x: 0, y: 0, z: 0, w: 40, d: 40 }];
  value.mechanisms = [{ id: 'mechanism-0', x: .9, y: 0, z: 0, name: 'Disjoncteur principal', kind: 'breaker', required: true }];
  value.doors = [{ id: 'door-0', x: 0, y: 0, z: -5, w: 5, d: .34, h: 3.1, requires: 'mechanism-0' }];
  value.lifts = [{ id: 'lift-0', x: 4, z: 0, w: 3.6, d: 4, axis: 'x', minY: 0, maxY: 3.2, speed: 1.6, requires: 'mechanism-0', lowerCall: { x: 1.6, y: 0, z: 0 }, upperCall: { x: 6.4, y: 3.2, z: 0 } }];
  return value;
}

test('F activates a mechanism once through a multi-substep frame and writes its checkpoint', () => {
  const app = harness(null, {}, mechanicalWorld);
  app.element('start').click(); app.key('KeyF'); app.frame(100); app.key('KeyF', false);
  const sim = app.simulations.at(-1), next = JSON.parse(app.memory.get(key));
  assert.equal(sim.state.mechanisms[0].active, true);
  assert.equal(next.checkpoint.systemsVersion, 1);
  assert.equal(next.checkpoint.state.mechanisms[0], true);
  assert.equal(app.element('mechanism-count').textContent, '1 / 1');
  assert.match(app.element('toast').textContent, /Disjoncteur principal.*point de reprise/);
  assert.equal(app.sounds.filter(s => s.name === 'mechanism').length, 1);
  app.key('KeyF', true, true); app.frame(100);
  assert.equal(app.sounds.filter(s => s.name === 'mechanism').length, 1, 'Key repeats cannot re-trigger a latched command');
  for (const mesh of app.frames.at(-1).meshes) assert.ok([...mesh.p, ...mesh.s, ...mesh.r].every(Number.isFinite), 'Interactive geometry must remain finite');
});

test('The contextual button operates a real lift, carries the camera, and saves the arrival', () => {
  const app = harness(null, {}, mechanicalWorld);
  app.element('start').click(); app.key('KeyF'); app.frame(100); app.key('KeyF', false);
  const sim = app.simulations.at(-1);
  // Move onto the actual platform using simulation movement, not a fabricated event.
  sim.move(sim.state.player, 4, 0); app.frame(100);
  assert.equal(app.element('interact-button').hidden, false);
  assert.equal(app.element('interact-button').disabled, false);
  assert.match(app.element('interaction-label').textContent, /Monter/);
  app.element('interact-button').click();
  for (let i = 0; i < 23; i++) app.frame(100);
  assert.ok(Math.abs(sim.state.player.y - 3.2) < 1e-8);
  assert.equal(app.sounds.filter(s => s.name === 'liftStart').length, 1);
  assert.equal(app.sounds.filter(s => s.name === 'liftStop').length, 1);
  const next = JSON.parse(app.memory.get(key));
  assert.ok(Math.abs(next.checkpoint.state.player.y - 3.2) < 1e-8, 'Save must contain the reached landing');
  assert.ok(app.frames.at(-1).camera.pos[1] > 4.7, 'Eye height must follow the carried player');
  const floor = app.frames.at(-1).meshes.find(m => m.ground && Math.abs(m.p[0] - 4) < 1e-8);
  assert.ok(floor && Math.abs(floor.p[1] + floor.s[1] / 2 - 3.2) < 1e-8, 'Visible lift surface must match physical height');
  assert.equal(app.element('altitude').textContent, 'ALT. 3,2 m');
  assert.equal(sim.restore(next.checkpoint), true, 'The arrived checkpoint must restore against the same machinery');
});

test('Options rebind the actual interaction key, persist it, and never start the expedition', () => {
  const app=harness(null,{},mechanicalWorld);
  app.element('intro-options').click();app.frame(100);
  assert.equal(app.element('body').dataset.state,'options');assert.equal(app.simulations.at(-1).state.elapsed,0);
  app.element('tab-controls').click();app.element('bind-interact').click();app.key('KeyE');
  assert.match(app.element('binding-status').textContent,/Déjà utilisée/);
  app.key('KeyR');assert.equal(JSON.parse(app.memory.get('ferro-settings')).bindings.interact[0],'KeyR');
  app.element('resume').click();app.element('start').click();app.key('KeyF');app.frame(100);app.key('KeyF',false);
  assert.equal(app.simulations.at(-1).state.mechanisms[0].active,false,'Old key must no longer activate');
  app.key('KeyR');app.frame(100);app.key('KeyR',false);
  assert.equal(app.simulations.at(-1).state.mechanisms[0].active,true);assert.equal(app.element('interact-key').textContent,'R');
});

test('Image and mix controls reach the renderer/audio and do not advance a paused simulation', () => {
  const app=harness(null);app.element('start').click();app.frame(100);app.key('KeyP');
  const elapsed=app.simulations.at(-1).state.elapsed;
  app.element('fov-setting').value='92';app.element('fov-setting').emit('input');
  app.element('brightness-setting').value='115';app.element('brightness-setting').emit('input');
  app.element('music-setting').value='20';app.element('music-setting').emit('input');
  app.element('shadows-toggle').click();app.element('bloom-toggle').click();app.element('fps-toggle').click();app.frame(100);
  assert.equal(app.simulations.at(-1).state.elapsed,elapsed);assert.equal(app.frames.at(-1).camera.fov,92);
  assert.equal(app.frames.at(-1).effects.shadows,false);assert.equal(app.frames.at(-1).effects.bloom,false);
  assert.equal(app.element('fps-counter').hidden,true);assert.equal(app.element('world').style.filter,'brightness(1.15)');
  assert.equal(app.sounds.filter(s=>s.name==='setMix').at(-1).args[0].music,.2);
  app.element('reset-image').click();app.frame(100);assert.equal(app.frames.at(-1).effects.shadows,true);
  assert.equal(JSON.parse(app.memory.get('ferro-settings')).musicVolume,.2,'Resetting graphics must preserve the audio mix');
});

function demolitionWorld(seed,stage){
  const w=world(seed,stage);
  w.meshes=[{shape:'box',p:[0,1.6,-6],s:[8,3.2,.4],mat:2,r:[0,0,0]}];
  w.colliders=[{minX:-4,maxX:4,minY:0,maxY:3.2,minZ:-6.2,maxZ:-5.8,mesh:0}];
  w.destructibles=[{id:'test-wall',kind:'wall',strength:3,meshes:[0],colliders:[0]}];
  return w;
}

test('Rupture input launches a physical projectile and sends a traversable breach to the renderer',()=>{
  const app=harness(null,{},demolitionWorld);app.element('start').click();
  const sim=app.simulations.at(-1);app.key('Digit3');app.frame(17);assert.equal(sim.state.weapon,2);
  app.key('Enter');app.frame(17);app.key('Enter',false);
  assert(sim.state.projectiles.some(q=>q.kind==='rocket'&&q.owner==='player'),'third weapon did not create a physical rocket');
  for(let i=0;i<75;i++)app.frame(17);
  assert(sim.destruction.revision>0,'rocket did not change the wall');
  assert(!sim.blocked(0,-6,.28,0),'visible blast did not open the actual collision');
  const update=app.worlds.filter(w=>!w.initial).at(-1);assert(update&&update.revision===sim.state.destructionRevision,'world update did not reach the renderer');
  assert.strictEqual(update.meshes,sim.destruction.meshes,'renderer received stale original geometry');
  assert(app.sounds.some(s=>s.name==='rocket')&&app.sounds.some(s=>s.name==='explosion'),'physical events did not reach audio');
  assert(app.frames.some(f=>f.effects.flash>0),'explosion/muzzle flash never reached renderer');
});

test('restoring intact geometry after a breach refreshes rendering even when controller revisions are reused',()=>{
  const app=harness(null,{},demolitionWorld);app.element('start').click();app.frame(17);
  const sim=app.simulations.at(-1),intact=sim.snapshot(),original=sim.destruction;
  sim.destruction.blast([0,1.2,-6],2.2,28);app.frame(17);
  const breached=app.worlds.at(-1),revision=breached.revision;assert(revision>0);
  assert.equal(sim.restore(intact),true);assert.notStrictEqual(sim.destruction,original);
  app.frame(17);const restored=app.worlds.at(-1);
  assert(restored.revision>revision,'restore reused a visual cache for different geometry');
  assert.strictEqual(restored.meshes,sim.destruction.meshes);assert.equal(restored.meshes.length,1);
  assert(sim.blocked(0,-6,.28,0),'intact checkpoint did not restore the physical wall');
});

test('difficulty settings affect the real simulation, persist, and preserve health and campaign state',()=>{
  const app=harness(null);app.element('intro-options').click();app.element('tab-game').click();
  const before=app.simulations.at(-1).state;app.element('difficulty-setting').value='2';app.element('difficulty-setting').emit('change');
  assert.equal(before.difficulty,2);assert.equal(before.elapsed,0);assert.equal(before.player.hp,100);
  assert.equal(JSON.parse(app.memory.get('ferro-settings')).difficulty,2);
  app.element('resume').click();app.element('start').click();app.frame(17);
  const sim=app.simulations.at(-1);assert.equal(sim.state.difficulty,2);
  app.key('KeyP');sim.state.player.hp=61;app.element('difficulty-setting').value='0';app.element('difficulty-setting').emit('change');
  assert.equal(sim.state.difficulty,0);assert.equal(sim.state.player.hp,61,'changing difficulty must not refill health');
  const restarted=harness(null,Object.fromEntries(app.memory));assert.equal(restarted.simulations.at(-1).state.difficulty,0);
});


test('audit: an older four-slot entry cannot block a healthy five-slot campaign checkpoint',async()=>{
  const original=harness(null,{},campaignShellWorld);original.element('start').click();advanceShellTo(original,6);
  const sim=original.simulations.at(-1);sim.move(sim.state.player,3,0);original.frame(100);
  sim.state.player.hp=63;sim.state.inventory.ammo[0]=19;
  const expected=plain(sim.exportLoadout()),saved=JSON.parse(original.memory.get(key));saved.checkpoint=sim.snapshot();
  saved.entryLoadout={inventory:{weapons:[true,false,false,false],ammo:[48,0,0,0],shield:false},equipment:{right:0,left:null,shieldEnergy:100}};
  const value=JSON.stringify(saved),resumed=harness(saved,{},campaignShellWorld);
  assert.equal(resumed.element('resume-expedition').hidden,false);
  await assert.doesNotReject(resumed.element('resume-expedition').click());
  const recovered=resumed.simulations.at(-1);
  assert.equal(resumed.element('body').dataset.state,'playing');assert.equal(recovered.state.world.index,6);
  assert.equal(recovered.state.player.hp,63);assert.equal(recovered.state.inventory.ammo[0],19);
  assert.deepEqual(plain(recovered.exportLoadout()),expected,'ownership, equipment and discoveries come from the healthy checkpoint');
  assert.equal(resumed.memory.get(key),value,'successful recovery cannot overwrite the original save');
  assert.equal(resumed.simulations.length,2);
});

test('audit: a campaign entry cannot block a healthy classic checkpoint or replace its resources',async()=>{
  const original=harness(null,{},arsenalWorld);original.element('start').click();
  const sim=original.simulations.at(-1);sim.state.player.hp=58;sim.state.inventory.ammo[0]=17;
  const expected=plain(sim.exportLoadout()),saved=JSON.parse(original.memory.get(key));saved.checkpoint=sim.snapshot();
  saved.entryLoadout={inventory:{weapons:[false,false,false,false,true],ammo:[0,0,0,0,1],shield:false},equipment:{right:4,left:null,shieldEnergy:100},campaign:{version:1,discovered:['pistol']}};
  const value=JSON.stringify(saved),resumed=harness(saved,{},arsenalWorld);
  assert.equal(resumed.element('resume-expedition').hidden,false);
  await assert.doesNotReject(resumed.element('resume-expedition').click());
  const recovered=resumed.simulations.at(-1);
  assert.equal(resumed.element('body').dataset.state,'playing');assert.equal(recovered.state.world.campaign,undefined);
  assert.equal(recovered.state.player.hp,58);assert.equal(recovered.state.inventory.ammo[0],17);
  assert.deepEqual(plain(recovered.exportLoadout()),expected);assert.equal(resumed.element('weapon-slot-4').hidden,true);
  assert.equal(resumed.memory.get(key),value);assert.equal(resumed.simulations.length,2);
});

test('audit: a classic three-slot entry migrates without gifts and remains the exact restart loadout',async()=>{
  const original=harness(null,{},arsenalWorld);original.element('start').click();
  const sim=original.simulations.at(-1);sim.state.player.hp=57;sim.state.inventory.ammo[0]=13;
  const expected=plain(sim.exportLoadout()),saved=JSON.parse(original.memory.get(key));saved.checkpoint=sim.snapshot();
  saved.entryLoadout={inventory:{weapons:[true,true,false],ammo:[9,2,0]}};
  const value=JSON.stringify(saved),resumed=harness(saved,{},arsenalWorld);
  await assert.doesNotReject(resumed.element('resume-expedition').click());
  assert.equal(resumed.element('body').dataset.state,'playing');
  assert.equal(resumed.simulations.at(-1).state.player.hp,57);
  assert.deepEqual(plain(resumed.simulations.at(-1).exportLoadout()),expected);
  assert.equal(resumed.memory.get(key),value);
  resumed.key('KeyP');resumed.key('KeyP',false);await resumed.element('restart').click();
  assert.deepEqual(plain(resumed.simulations.at(-1).exportInventory()),{weapons:[true,true,false,false],ammo:[9,2,0,0],shield:false});
});

test('audit: checkpoint inventory slots inconsistent with its campaign envelope are refused without touching storage',()=>{
  for(const campaign of [false,true]){
    const factory=campaign?campaignShellWorld:arsenalWorld,original=harness(null,{},factory);original.element('start').click();
    const saved=JSON.parse(original.memory.get(key));
    saved.checkpoint.state.inventory=campaign?{weapons:[true,false,false,false],ammo:[48,0,0,0],shield:false}:{weapons:[false,false,false,false,true],ammo:[0,0,0,0,1],shield:false};
    const value=JSON.stringify(saved),resumed=harness(saved,{},factory);
    assert.equal(resumed.element('resume-expedition').hidden,true);
    assert.equal(resumed.memory.get(key),value);assert.equal(resumed.simulations.length,1,'the invalid checkpoint never reaches load');
  }
});

test('audit: weapon hints follow campaign and classic mode, custom fifth binding and the real first trophy schedule',async()=>{
  const app=harness(null,{},campaignShellWorld);app.element('start').click();
  assert.equal(app.element('weapon-switch').title,'Armes : 1 / 2 / 3 / 4 / 5 ou molette');
  assert.match(app.element('toast').textContent,/premier trophée au monde 4/);
  const preferences=app.context.FOptions.defaults(false);preferences.bindings.weapon5=['KeyB'];
  const custom=harness(null,{'ferro-settings':JSON.stringify(preferences)},campaignShellWorld);
  assert.equal(custom.element('weapon-switch').title,'Armes : 1 / 2 / 3 / 4 / B ou molette');
  const classic=harness(null,{},arsenalWorld);classic.element('start').click();
  const resumed=harness(JSON.parse(classic.memory.get(key)),{},campaignShellWorld);
  assert.equal(resumed.element('weapon-switch').title,'Armes : 1 / 2 / 3 / 4 / 5 ou molette','the menu initially previews a new campaign');
  await resumed.element('resume-expedition').click();
  assert.equal(resumed.element('weapon-switch').title,'Armes : 1 / 2 / 3 / 4 ou molette','resuming classic mode refreshes the hint immediately');
  assert.equal(resumed.element('weapon-slot-4').hidden,true);
});

// Exercise the real browser shell's Continue action and storage writes without
// a renderer. Simulation validation remains real; only browser/audio APIs are stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url), key = 'ferro-expedition-v2';
const sources = Object.fromEntries(['destruction', 'simulation', 'motion', 'actors', 'effects', 'options', 'game'].map(name =>
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

function harness(saved, initial = {}, createWorld = world) {
  const memory = new Map(Object.entries(initial));
  if (saved) memory.set(key, JSON.stringify(saved));
  const elements = new Map(), errors = [], simulations = [], listeners = new Map(), frames = [], sounds = [], worlds = [];
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
      setAttribute: noop, focus: noop, getContext: () => draw, requestPointerLock: noop,
    };
    elements.set(id, value); return value;
  }
  const context = { console: { error: (...args) => errors.push(args) }, performance: { now: () => now }, innerWidth: 1280, innerHeight: 800,
    URLSearchParams, navigator: { maxTouchPoints: 0 }, location: { search: '' },
    matchMedia: () => ({ matches: false }), requestAnimationFrame: callback => { nextFrame = callback; }, addEventListener: (name, callback) => listeners.set(name, callback),
    document: { body: element('body'), getElementById: element, addEventListener: noop, hasFocus: () => true },
    localStorage: { getItem: name => memory.get(name) ?? null, setItem: (name, value) => memory.set(name, String(value)), removeItem: name => memory.delete(name) },
    FWorld: { create: createWorld }, FAudio: { create: () => new Proxy({}, { get: (_, name) => (...args) => sounds.push({ name, args }) }) },
    FRender: { create: () => ({ stats: { backend: 'test' }, resize: noop, setWorld: (meshes, lights) => worlds.push({ meshes, lights, initial:true }), updateWorld: (meshes, revision, lights) => worlds.push({meshes,revision,lights}), draw: (camera, meshes, effects) => frames.push({ camera, meshes, effects }) }) },
  };
  context.window = context; vm.createContext(context);
  for (const name of ['destruction', 'simulation', 'motion', 'actors', 'effects', 'options']) vm.runInContext(sources[name], context, { filename: `${name}.js` });
  const create = context.FSimulation.create;
  context.FSimulation.create = value => { const sim = create(value); simulations.push(sim); return sim; };
  vm.runInContext(sources.game, context, { filename: 'game.js' });
  assert.deepEqual(errors, [], 'Browser shell initialization must succeed');
  return { memory, element, simulations, context, frames, sounds, worlds,
    frame: ms => { now += ms; nextFrame(now); },
    key: (code, down = true, repeat = false) => listeners.get(down ? 'keydown' : 'keyup')?.({ code, repeat, preventDefault: noop }) };
}

function savedPoint(generation = 5) {
  const context = { window: {} }; vm.createContext(context); vm.runInContext(sources.destruction, context); vm.runInContext(sources.simulation, context);
  const sim = context.window.FSimulation.create(world(96, 2));
  sim.state.player.x = 6; sim.step(.025, {}); // Take a relay through the real interaction.
  sim.state.weapon = 1;
  assert.equal(sim.state.relays, 1);
  return { version: 2, generation, seed: 96, stage: 2, runStats: { ...previousStats }, checkpoint: sim.snapshot() };
}

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
  const backup = '{"previous":"original untouched save"}', app = harness(saved, { [key + '-before-ascension']: backup, [key + '-before-horizons']: 'older backup' });
  app.element('resume-expedition').click();
  const next = JSON.parse(app.memory.get(key));
  assert.equal(next.stage, 2); assert.deepEqual(next.runStats, previousStats);
  assert.equal(next.checkpoint.state.relays, 0);
  assert.equal(app.memory.get(key + '-before-ascension'), backup);
  assert.equal(app.memory.get(key + '-before-horizons'), 'older backup');
  assert.match(app.element('toast').textContent, /illisible/);
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

// Exercise the real browser shell's Continue action and storage writes without
// a renderer. Simulation validation remains real; only browser/audio APIs are stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url), key = 'ferro-expedition-v2';
const sources = Object.fromEntries(['simulation', 'motion', 'game'].map(name =>
  [name, readFileSync(new URL(`src/${name}.js`, root), 'utf8')]));
const previousStats = { time: 316, kills: 21, shots: 72, hits: 43, score: 4730 };

function world(seed, stage) {
  return {
    seed, stage, generation: 4, title: `Secteur ${stage + 1}`,
    spawn: { x: 0, z: 0, yaw: 0 }, bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    meshes: [], lights: [], colliders: [], enemies: [], pickups: [], hazards: [],
    rooms: [{ x: 0, z: 0, w: 40, d: 40, name: 'Lisière', outdoor: true }], corridors: [],
    environment: { biome: 'woodland', outdoorZones: [{ x: 0, z: 0, w: 40, d: 40 }] },
    cores: [{ id: 0, x: 6, z: 0 }, { id: 1, x: 8, z: 0 }, { id: 2, x: 10, z: 0 }],
    exit: { x: 15, z: 0 },
  };
}

function harness(saved, initial = {}) {
  const memory = new Map(Object.entries(initial));
  if (saved) memory.set(key, JSON.stringify(saved));
  const elements = new Map(), errors = [], simulations = [];
  const noop = () => {}, draw = new Proxy({}, { get: () => noop });
  function element(id) {
    if (elements.has(id)) return elements.get(id);
    const events = new Map(), classes = new Set();
    const value = { hidden: false, textContent: '', innerHTML: '', style: {}, dataset: {}, firstChild: { textContent: '' },
      classList: { add: name => classes.add(name), remove: name => classes.delete(name),
        toggle(name, enabled) { enabled ??= !classes.has(name); enabled ? classes.add(name) : classes.delete(name); } },
      addEventListener: (name, callback) => events.set(name, callback),
      click: () => events.get('click')?.(),
      querySelector: selector => element(id + selector),
      querySelectorAll: () => [0, 1, 2].map(n => element(id + n)),
      setAttribute: noop, focus: noop, getContext: () => draw, requestPointerLock: noop,
    };
    elements.set(id, value); return value;
  }
  const context = { console: { error: (...args) => errors.push(args) }, performance: { now: () => 0 },
    URLSearchParams, navigator: { maxTouchPoints: 0 }, location: { search: '' },
    matchMedia: () => ({ matches: false }), requestAnimationFrame: noop, addEventListener: noop,
    document: { body: element('body'), getElementById: element, addEventListener: noop },
    localStorage: { getItem: name => memory.get(name) ?? null, setItem: (name, value) => memory.set(name, String(value)), removeItem: name => memory.delete(name) },
    FWorld: { create: world }, FAudio: { create: () => new Proxy({}, { get: () => noop }) },
    FRender: { create: () => ({ stats: { backend: 'test' }, resize: noop, setWorld: noop }) },
  };
  context.window = context; vm.createContext(context);
  for (const name of ['simulation', 'motion']) vm.runInContext(sources[name], context, { filename: `${name}.js` });
  const create = context.FSimulation.create;
  context.FSimulation.create = value => { const sim = create(value); simulations.push(sim); return sim; };
  vm.runInContext(sources.game, context, { filename: 'game.js' });
  assert.deepEqual(errors, [], 'Browser shell initialization must succeed');
  return { memory, element, simulations, context };
}

function savedPoint(generation = 4) {
  const context = { window: {} }; vm.createContext(context); vm.runInContext(sources.simulation, context);
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
  assert.equal(app.memory.get(key + '-before-horizons'), undefined);
});

for (const generation of [3, undefined]) test(`Continue migrates generation ${generation ?? 'legacy'} to the same sector without losing prior-sector totals`, () => {
  const saved = savedPoint(3); if (generation === undefined) delete saved.generation;
  const app = harness(saved), original = app.memory.get(key);
  app.element('resume-expedition').click();
  const next = JSON.parse(app.memory.get(key)), state = app.simulations.at(-1).state;
  assert.equal(app.element('body').dataset.state, 'playing');
  assert.equal(next.stage, 2); assert.equal(next.seed, 96); assert.equal(next.generation, 4);
  assert.deepEqual(next.runStats, previousStats);
  assert.equal(state.relays, 0); assert.equal(state.player.x, 0); assert.equal(state.weapon, 1);
  assert.equal(app.memory.get(key + '-before-horizons'), original);
  assert.match(app.element('toast').textContent, /même secteur/);
  assert.equal(app.simulations.at(-1).restore(next.checkpoint), true, 'New stored point must be usable');
});

test('An invalid snapshot restarts its sector and preserves the first migration backup', () => {
  const saved = savedPoint(); saved.checkpoint.fingerprint = 'incompatible-world';
  const backup = '{"previous":"original untouched save"}', app = harness(saved, { [key + '-before-horizons']: backup });
  app.element('resume-expedition').click();
  const next = JSON.parse(app.memory.get(key));
  assert.equal(next.stage, 2); assert.deepEqual(next.runStats, previousStats);
  assert.equal(next.checkpoint.state.relays, 0);
  assert.equal(app.memory.get(key + '-before-horizons'), backup);
  assert.match(app.element('toast').textContent, /illisible/);
});

// Local copy of checks/checkpoint.test.mjs harness (lines 8-66, commit 673d6b2) for measurement only.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const ROOT=process.env.FERRO_ROOT;
const root = new URL('file://'+ROOT+'/'), key = 'ferro-expedition-v2';
const sources = Object.fromEntries(['destruction', 'economy', 'brain', 'simulation', 'motion', 'actors', 'effects', 'soundscape', 'options', 'game'].map(name =>
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
  const elements = new Map(), errors = [], simulations = [], listeners = new Map(), frames = [], sounds = [], worlds = [], brains = [], simulationOptions = [];
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
      setAttribute: noop, focus: noop, setPointerCapture: noop, getContext: () => draw, requestPointerLock: noop,
    };
    elements.set(id, value); return value;
  }
  const context = { console: { error: (...args) => errors.push(args) }, performance: { now: () => now }, innerWidth: 1280, innerHeight: 800,
    URLSearchParams, setTimeout, clearTimeout, navigator: { maxTouchPoints: 0 }, location: { search: '' },
    matchMedia: () => ({ matches: false }), requestAnimationFrame: callback => { nextFrame = callback; }, addEventListener: (name, callback) => listeners.set(name, callback),
    document: { body: element('body'), getElementById: element, addEventListener: noop, hasFocus: () => true },
    localStorage: { getItem: name => memory.get(name) ?? null, setItem: (name, value) => memory.set(name, String(value)), removeItem: name => memory.delete(name) },
    FWorld: { create: createWorld }, FAudio: { create: () => new Proxy({}, { get: (_, name) => (...args) => sounds.push({ name, args }) }) },
    FRender: { create: () => ({ stats: { backend: 'test' }, resize: noop, setWorld: (meshes, lights) => worlds.push({ meshes, lights, initial:true }), updateWorld: (meshes, revision, lights) => worlds.push({meshes,revision,lights}), draw: (camera, meshes, effects) => frames.push({ camera, meshes, effects }) }) },
  };
  context.window = context; vm.createContext(context);
  for (const name of ['destruction', 'economy', 'simulation', 'motion', 'actors', 'effects', 'soundscape', 'options']) vm.runInContext(sources[name], context, { filename: `${name}.js` });
  if(runtime.brain){vm.runInContext(sources.brain, context, {filename:'brain.js'});const createBrain=context.FBrain.create;context.FBrain.create=options=>{const brain=createBrain(options);brains.push(brain);return brain;};}
  const create = context.FSimulation.create;
  context.FSimulation.create = (value, options) => { const sim = create(value, options); simulations.push(sim); simulationOptions.push(options); return sim; };
  vm.runInContext(sources.game, context, { filename: 'game.js' });
  assert.deepEqual(errors, [], 'Browser shell initialization must succeed');
  return { memory, element, simulations, context, frames, sounds, worlds, brains, simulationOptions,
    frame: ms => { now += ms; nextFrame(now); },
    emit: (name,event={}) => listeners.get(name)?.({type:name,preventDefault:noop,...event}),
    key: (code, down = true, repeat = false) => listeners.get(down ? 'keydown' : 'keyup')?.({ code, repeat, preventDefault: noop }) };
}

export {harness,world};

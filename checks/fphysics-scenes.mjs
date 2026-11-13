// FPhysics test helpers: loaders and deterministic inputs (lot 17, module side; not bundled in the game).
// Scenes, runChain and hashes come with the box core (step 2 of the module brief).
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const SOURCE = new URL('../src/physics.js', import.meta.url);
let text = null;

// Text of src/physics.js, read once.
export function source() {
  if (text === null) text = readFileSync(SOURCE, 'utf8');
  return text;
}

// Main realm, like a classic script in the page: `window` is a fresh object that receives FPhysics.
export function load() {
  const w = {};
  new Function('window', source())(w);
  return w.FPhysics;
}

// Separate vm realm (diagnostic only: 4.5 to 9 times slower, never used for timings).
export function loadVm() {
  const ctx = {window: {}};
  vm.runInNewContext(source(), ctx, {filename: 'physics.js'});
  return ctx.window.FPhysics;
}

// Integer LCG of docs/chantier-moteur/bancs/phys/scenes.mjs: same sequence for the same seed.
export function lcg(seed) {
  let n = seed >>> 0 || 1;
  return () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; };
}

export const B64 = Object.freeze({minX: -64, maxX: 64, minZ: -64, maxZ: 64});
export const NOSLEEP = Object.freeze({sleepTime: 1e9, fallbackTime: 1e9});

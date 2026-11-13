// FPhysics test helpers: loaders, deterministic inputs and scenes (lot 17, module side; not bundled in the game).
// Module step 2a brings the box scenes stack10 and pyramid55 and runChain; rubble300, blast200, mix and hashes()
// come with the scenes that need them (steps 2b and 10 of the module brief).
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

// Crate of the brief (§7): box of 0.8 m, mass 30, friction 0.6, restitution 0.1.
export function crate(w, x, y, z) {
  return w.addBody({size: [0.8, 0.8, 0.8], pos: [x, y, z], mass: 30, friction: 0.6, restitution: 0.1});
}

// Scenes (brief §8.1): (F, opts) -> {w, ids, ideal?, tick?}; tick(i), when present, runs before sub-step i.
export const SCENES = Object.freeze({
  // 10 crates in a column on the ground slab (prototype stack).
  stack10(F, opts = {}) {
    const w = F.create({bounds: B64, ground: 0, capacity: 64, ...opts}), ids = [], ideal = [];
    for (let i = 0; i < 10; i++) { const p = [0, 0.4 + 0.8 * i, 0]; ids.push(crate(w, ...p)); ideal.push(p); }
    return {w, ids, ideal};
  },
  // 55 crates in rows of 10 down to 1 (prototype pyramid): x = (k - (10 - row - 1)/2)*0.82.
  pyramid55(F, opts = {}) {
    const w = F.create({bounds: B64, ground: 0, capacity: 128, ...opts}), ids = [], ideal = [];
    for (let row = 0; row < 10; row++) for (let k = 0; k < 10 - row; k++) {
      const p = [(k - (10 - row - 1) / 2) * 0.82, 0.4 + row * 0.8, 0];
      ids.push(crate(w, ...p)); ideal.push(p);
    }
    return {w, ids, ideal};
  },
});

// Chain 'cccccccc/hhhhhhhh' (brief §8.1): FNV-1a over the characters of w.hash() every 50 sub-steps, then the last hash.
export function runChain(F, name, steps, opts) {
  const {w, tick} = SCENES[name](F, opts);
  let c = 2166136261;
  for (let i = 0; i < steps; i++) {
    if (tick) tick(i);
    w.step(1 / 120);
    if (i % 50 === 49) for (const ch of w.hash()) c = Math.imul(c ^ ch.charCodeAt(0), 16777619);
  }
  return (c >>> 0).toString(16).padStart(8, '0') + '/' + w.hash();
}

// Horizontal drift: max of sqrt((x - x0)^2 + (z - z0)^2) against the ideal poses (bancs/phys/drift.mjs).
export function drift(w, ids, ideal) {
  let m = 0;
  ids.forEach((h, k) => { const p = w.body(h).pos; m = Math.max(m, Math.hypot(p[0] - ideal[k][0], p[2] - ideal[k][2])); });
  return m;
}

// Lowest vertex: min of the y of the 8 corners of the collision boxes (matrix row 1 = Y components of the local axes).
export function lowest(w, ids) {
  let m = Infinity;
  const r = new Array(9);
  for (const h of ids) {
    const b = w.body(h), e = b.size.map(s => s / 2);
    w.matrix(h, r);
    for (let k = 0; k < 8; k++) {
      const y = b.pos[1] + r[3] * (k & 1 ? e[0] : -e[0]) + r[4] * (k & 2 ? e[1] : -e[1]) + r[5] * (k & 4 ? e[2] : -e[2]);
      if (y < m) m = y;
    }
  }
  return m;
}

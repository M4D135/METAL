// Deterministic test scenes for the FPhys prototype. All randomness comes from an integer LCG.
import { create } from './fphys.mjs';
export function lcg(seed) { let n = seed >>> 0 || 1; return () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; }; }
const MAT = { metal: { d: 65, f: 0.45, r: 0.24 }, stone: { d: 28, f: 0.7, r: 0.16 }, wood: { d: 8, f: 0.55, r: 0.22 }, glass: { d: 25, f: 0.35, r: 0.16 }, dirt: { d: 12, f: 0.8, r: 0.05 } };
const NAMES = Object.keys(MAT);
export function stack10(opts = {}) {
  const w = create({ capacity: 64, ...opts }); w.buildStatics(); const ids = [];
  for (let i = 0; i < 10; i++)ids.push(w.addBox(0, 0.4 + i * 0.8, 0, 0.4, 0.4, 0.4, 30, 0.6, 0.1));
  return { w, ids, ideal: i => [0, 0.4 + i * 0.8, 0] };
}
export function pyramid55(opts = {}) {
  const w = create({ capacity: 128, ...opts }); w.buildStatics(); const ids = [], ideal = [];
  for (let row = 0; row < 10; row++)for (let k = 0; k < 10 - row; k++) { const x = (k - (10 - row - 1) / 2) * 0.82, y = 0.4 + row * 0.8; ids.push(w.addBox(x, y, 0, 0.4, 0.4, 0.4, 30, 0.6, 0.1)); ideal.push([x, y, 0]); }
  return { w, ids, ideal: i => ideal[i] };
}
function walls(w) { // three walls and a low kerb around a 7 x 7 m yard, as axis-aligned static boxes
  w.addStatic(-4, 0, -4, -3.5, 4, 4); w.addStatic(3.5, 0, -4, 4, 4, 4); w.addStatic(-4, 0, -4, 4, 4, -3.5); w.addStatic(-4, 0, 3.5, 4, 0.5, 4); w.addStatic(-1, 0, -1, 1, 0.6, 1); w.buildStatics();
}
export function rubble300(opts = {}) {
  const w = create({ capacity: 512, ...opts }); walls(w); const rnd = lcg(opts.seed || 20261112), ids = [];
  for (let i = 0; i < 300; i++) {
    const m = MAT[NAMES[i % 5]], slab = rnd() < 0.3, hx = 0.06 + rnd() * (slab ? 0.5 : 0.25), hy = slab ? 0.04 + rnd() * 0.06 : 0.06 + rnd() * 0.25, hz = 0.06 + rnd() * (slab ? 0.4 : 0.25);
    const col = i % 36, layer = (i / 36) | 0, x = -2.6 + (col % 6) * 1.04 + (rnd() - 0.5) * 0.1, z = -2.6 + ((col / 6) | 0) * 1.04 + (rnd() - 0.5) * 0.1, y = 1.2 + layer * 1.1;
    let qx = rnd() - 0.5, qy = rnd() - 0.5, qz = rnd() - 0.5, qw = rnd() - 0.5; const l = Math.sqrt(qx * qx + qy * qy + qz * qz + qw * qw) || 1; qx /= l; qy /= l; qz /= l; qw /= l;
    const mass = Math.max(0.5, Math.min(160, 8 * hx * hy * hz * m.d)); ids.push(w.addBox(x, y, z, hx, hy, hz, mass, m.f, m.r, qx, qy, qz, qw));
  }
  return { w, ids };
}
export function blast200(opts = {}) {
  const w = create({ capacity: 256, ...opts }); w.addStatic(-13, 0, -13, -12.5, 30, 13); w.addStatic(12.5, 0, -13, 13, 30, 13); w.addStatic(-13, 0, -13, 13, 30, -12.5); w.addStatic(-13, 0, 12.5, 13, 30, 13); w.buildStatics();
  const rnd = lcg(opts.seed || 77), ids = []; let placed = 0;
  for (let gz = 0; gz < 10 && placed < 200; gz++)for (let gx = 0; gx < 10 && placed < 200; gx++) {
    const x = -10.8 + gx * 2.4 + (rnd() - 0.5) * 0.3, z = -10.8 + gz * 2.4 + (rnd() - 0.5) * 0.3, barrel = (gx + gz) % 3 === 0, hx = barrel ? 0.3 : 0.3 + rnd() * 0.2, hy = barrel ? 0.45 : hx, hz = hx, pile = barrel ? 1 : 3;
    for (let k = 0; k < pile && placed < 200; k++) { ids.push(w.addBox(x, hy + k * 2 * hy + 0.001 * k, z, hx, hy, hz, barrel ? 25 : Math.max(4, 8 * hx * hy * hz * 60), barrel ? 0.45 : 0.6, barrel ? 0.24 : 0.2)); placed++; }
  }
  return { w, ids };
}
export const SCENES = { stack10, pyramid55, rubble300, blast200 };

// A/B of FWorld.create: original vs patched copy, alternated in one process; identical output check (FNV of JSON).
// usage: node gen-ab.mjs <ferroRoot> <patchedDir> <spec...>
import {load, makeWorld, now} from './lib.mjs';
const [root, dir, ...specs] = process.argv.slice(2);
const A = load(root), B = load(root, [], dir);
const fnv = s => { let f = 2166136261; for (let i = 0; i < s.length; i++) f = Math.imul(f ^ s.charCodeAt(i), 16777619); return (f >>> 0).toString(36); };
for (const spec of specs) {
  const ta = [], tb = []; let ha, hb;
  for (let rep = 0; rep < 4; rep++) {
    let t = now(); const wa = makeWorld(A, spec); ta.push(now() - t);
    t = now(); const wb = makeWorld(B, spec); tb.push(now() - t);
    if (rep === 0) { ha = fnv(JSON.stringify(wa)); hb = fnv(JSON.stringify(wb)); }
  }
  const med = a => a.slice().sort((x, y) => x - y)[a.length >> 1];
  console.log(JSON.stringify({spec, originalMedianMs: +med(ta).toFixed(1), patchedMedianMs: +med(tb).toFixed(1), gain: +(1 - med(tb) / med(ta)).toFixed(3), identical: ha === hb, hash: ha}));
}

// Banc lot 05 : FEffects.build apparié entre deux racines, même état, même caméra, ordre alterné.
// usage: node tools/proof/lot05/effects-ab2.mjs <racineA>,<racineB> [frames=3000] [world=camp:17]
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import vm from 'node:vm';
import {isDeepStrictEqual} from 'node:util';

const argv = process.argv.slice(2);
const roots = (argv[0] || '.').split(',').map(r => resolve(r));
const frames = +(argv[1] || 3000), [kind, idx] = (argv[2] || 'camp:17').split(':');
const out = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : null;
const {makeScene} = await import(new URL('../render-scene.mjs', import.meta.url).href);
const S = makeScene(roots[0], {world: [kind, +idx], seed: 96, quality: 'auto', content: false, record: false});
const mods = ['fmath', 'renderer', 'passages', 'world', 'destruction', 'economy', 'brain', 'simulation', 'actors', 'motion'];
const win = {innerWidth: 1280, innerHeight: 720, devicePixelRatio: 2};
for (const n of mods) {
  if (n === 'passages' && !existsSync(roots[0] + '/src/passages.js')) continue;
  vm.runInThisContext('(function(window){' + readFileSync(roots[0] + '/src/' + n + '.js', 'utf8') + '\n})', {filename: n + '.js'})(win);
}
const builds = roots.map((root, i) => {
  const w = {FRender: win.FRender};
  vm.runInThisContext('(function(window){' + readFileSync(root + '/src/effects.js', 'utf8') + '\n})', {filename: 'effects-' + i + '.js'})(w);
  return w.FEffects.build;
});
const now = () => Number(process.hrtime.bigint());
const q = (a, p) => { const v = a.slice().sort((x, y) => x - y); return v[Math.min(v.length - 1, Math.floor(v.length * p))]; };
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const A = [], B = [], ratios = [];
let checked = 0, mismatches = 0, debrisMax = 0;
const opt = {quality: 'auto', backend: 'webgl2'};
for (let i = 0; i < frames + 120; i++) {
  const r = S.frame(1 / 60, {time: false}), st = S.sim.state;
  debrisMax = Math.max(debrisMax, (st.debris || []).length);
  let a, b, ta, tb, t;
  if (i & 1) { t = now(); b = builds[1](st, S.world, r.camera, opt); tb = now() - t; t = now(); a = builds[0](st, S.world, r.camera, opt); ta = now() - t; }
  else { t = now(); a = builds[0](st, S.world, r.camera, opt); ta = now() - t; t = now(); b = builds[1](st, S.world, r.camera, opt); tb = now() - t; }
  if (i < 120) continue;
  A.push(ta / 1e6); B.push(tb / 1e6); ratios.push(tb / ta); checked++;
  if (!isDeepStrictEqual(a, b)) mismatches++;
}
const report = {banc: 'FEffects.build apparié, même état et même caméra, ordre alterné (120 images de chauffe exclues)',
  world: kind + ':' + idx, frames: checked, node: process.version, debrisMax,
  identiques: (checked - mismatches) + ' / ' + checked,
  A: {racine: roots[0], p50: +q(A, .5).toFixed(4), p95: +q(A, .95).toFixed(4), p99: +q(A, .99).toFixed(4), moyenne: +mean(A).toFixed(4)},
  B: {racine: roots[1], p50: +q(B, .5).toFixed(4), p95: +q(B, .95).toFixed(4), p99: +q(B, .99).toFixed(4), moyenne: +mean(B).toFixed(4)},
  ratioP50: +(q(B, .5) / q(A, .5)).toFixed(4), ratioP95: +(q(B, .95) / q(A, .95)).toFixed(4), ratioParPaire: +q(ratios, .5).toFixed(4)};
const text = JSON.stringify(report, null, 1) + '\n';
if (out) writeFileSync(out, text);
console.log(text);

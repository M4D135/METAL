// Banc lot 05 T11/T17 : FActors.build apparié entre deux racines (temps et octets alloués).
// usage: node tools/proof/lot05/actors-cost.mjs <racineA>,<racineB> [reps=400] [--poses N]
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import vm from 'node:vm';
import v8 from 'node:v8';
import {isDeepStrictEqual} from 'node:util';

const argv = process.argv.slice(2);
const roots = (argv[0] || '.').split(',').map(r => resolve(r));
const reps = +(argv[1] || 400);
const out = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : null;
const HEIGHT = [1.35, 1.05, 1.6, 1.8];
const loadFRender = root => {
  const w = {};
  vm.runInThisContext('(function(window){' + readFileSync(root + '/src/renderer.js', 'utf8') + '\n})', {filename: 'renderer.js'})(w);
  return w.FRender;
};
const builds = roots.map((root, i) => {
  const w = {FRender: loadFRender(root)};
  vm.runInThisContext('(function(window){' + readFileSync(root + '/src/actors.js', 'utf8') + '\n})', {filename: 'actors-' + i + '.js'})(w);
  return w.FActors.build;
});
function actor(type, distance, i) {
  const states = ['idle', 'aim', 'burst', 'rush', 'stunned', 'airborne'];
  const st = states[i % states.length];
  return {id: type * 7 + i, type, x: i * .7, z: -i * .5, baseY: HEIGHT[type], y: HEIGHT[type] + Math.sin(i), yaw: i * .31,
    hp: type === 3 ? 30 : 10, moveSpeed: 1.4, awareness: 'engage', attackState: st, stun: st === 'stunned' ? .5 : 0,
    hurt: (i % 5) * .1, windup: st === 'rush' ? .3 : 0, windupMax: .8, aimX: 3, aimY: 4, aimZ: -6, airborne: st === 'airborne',
    bossScale: type === 3 ? 2.2 : undefined, bossKind: 'custodian'};
}
const CASES = [];
for (const type of [0, 1, 2, 3]) for (const distance of [3, 18, 60]) for (let i = 0; i < 6; i++) CASES.push([type, distance, i]);
const opts = distance => ({time: 2.5, phase: .7, blend: .8, distance, quality: 'auto', backend: 'webgl2'});
// identité
let mismatches = 0;
for (const [type, distance, i] of CASES) {
  const a = builds[0](actor(type, distance, i), opts(distance)), b = builds[1](actor(type, distance, i), opts(distance));
  if (!isDeepStrictEqual(a, b)) mismatches++;
}
// temps apparié
const now = () => Number(process.hrtime.bigint());
const q = (a, p) => { const v = a.slice().sort((x, y) => x - y); return v[Math.min(v.length - 1, Math.floor(v.length * p))]; };
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const A = [], B = [], ratios = [];
// RCPU-11 : un réservoir par cas, comme en jeu (un tableau par ennemi, réutilisé chaque image).
const pools = new Map();
const poolFor = key => { let p = pools.get(key); if (!p) { p = []; pools.set(key, p); } return p; };
for (let rep = 0; rep < reps + 40; rep++) {
  for (const [type, distance, i] of CASES) {
    const e = actor(type, distance, i), o = opts(distance);
    o.pool = poolFor(type + ':' + distance + ':' + i);
    let x, y, t;
    if ((rep + i) & 1) { t = now(); builds[1](e, o); y = now() - t; t = now(); builds[0](e, o); x = now() - t; }
    else { t = now(); builds[0](e, o); x = now() - t; t = now(); builds[1](e, o); y = now() - t; }
    if (rep < 40) continue;
    A.push(x / 1e6); B.push(y / 1e6); ratios.push(y / x);
  }
}
// octets alloués par build : tas vidé, puis N builds, puis delta de tas
v8.setFlagsFromString('--expose-gc');
const gc = vm.runInNewContext('gc');
function bytes(build) {
  for (let k = 0; k < 20; k++) for (const [type, distance, i] of CASES) build(actor(type, distance, i), Object.assign(opts(distance), {pool: poolFor(type + ':' + distance + ':' + i)}));
  for (let k = 0; k < 3; k++) { gc(); gc(); }
  const before = process.memoryUsage().heapUsed;
  const keep = [];
  for (let k = 0; k < 200; k++) for (const [type, distance, i] of CASES) keep.push(build(actor(type, distance, i), Object.assign(opts(distance), {pool: poolFor(type + ':' + distance + ':' + i)})));
  const after = process.memoryUsage().heapUsed;
  const total = keep.reduce((n, l) => n + l.length, 0);
  keep.length = 0;
  return {koParBuild: +((after - before) / 1024 / (200 * CASES.length)).toFixed(2), maillagesParBuild: +(total / (200 * CASES.length)).toFixed(2)};
}
const bytesA = bytes(builds[0]), bytesB = bytes(builds[1]);
const report = {banc: 'FActors.build apparié (4 types x 3 distances x 6 poses), ordre alterné, 40 passages de chauffe exclus',
  node: process.version, cas: CASES.length, reps,
  identiques: (CASES.length - mismatches) + ' / ' + CASES.length,
  A: {racine: roots[0], p50Ms: +q(A, .5).toFixed(5), p95Ms: +q(A, .95).toFixed(5), moyenneMs: +mean(A).toFixed(5), ...bytesA},
  B: {racine: roots[1], p50Ms: +q(B, .5).toFixed(5), p95Ms: +q(B, .95).toFixed(5), moyenneMs: +mean(B).toFixed(5), ...bytesB},
  ratioP50: +(q(B, .5) / q(A, .5)).toFixed(4), ratioP95: +(q(B, .95) / q(A, .95)).toFixed(4),
  ratioParPaire: +q(ratios, .5).toFixed(4), ratioOctets: +(bytesB.koParBuild / bytesA.koParBuild).toFixed(4)};
const text = JSON.stringify(report, null, 1) + '\n';
if (out) (await import('node:fs')).writeFileSync(out, text);
console.log(text);

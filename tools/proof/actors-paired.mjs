// Banc apparié FActors.build entre deux racines, avec contrôle « même racine contre elle-même ».
// usage: node .relais/actors-paired.mjs <racineA>,<racineB> [reps=400] [warm=40]
// Chargement dans le processus principal (pas de node:vm), comme l'exige la mission.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {isDeepStrictEqual} from 'node:util';

const argv = process.argv.slice(2);
const roots = (argv[0] || '.').split(',').map(r => resolve(r));
const reps = +(argv[1] ?? 400);
const warm = +(argv[2] ?? 40);
// mode réservoir : single (un tableau par cas, comme T17 en jeu) | alt2 (deux tampons alternés)
const POOL_MODE = argv[3] || 'single';
const NBUF = POOL_MODE === 'alt2' ? 2 : POOL_MODE === 'alt4' ? 4 : 1;
const HEIGHT = [1.35, 1.05, 1.6, 1.8];

function load(root) {
  const w = {};
  new Function('window', readFileSync(root + '/src/renderer.js', 'utf8'))(w);
  const w2 = {FRender: w.FRender};
  new Function('window', readFileSync(root + '/src/actors.js', 'utf8'))(w2);
  return {FRender: w.FRender, build: w2.FActors.build};
}
const mods = roots.map(load);

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

// identité des sorties (sans réservoir)
let mismatches = 0;
for (const [type, distance, i] of CASES) {
  const a = mods[0].build(actor(type, distance, i), opts(distance));
  const b = mods[1].build(actor(type, distance, i), opts(distance));
  if (!isDeepStrictEqual(a, b)) mismatches++;
}

const now = () => Number(process.hrtime.bigint());
const q = (a, p) => { const v = a.slice().sort((x, y) => x - y); return v[Math.min(v.length - 1, Math.floor(v.length * p))]; };
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;

// réservoirs durables, un par cas : c'est le comportement de jeu (un tableau par ennemi)
const pools = new Map();
const poolFor = (key, buf) => { let m = pools.get(key); if (!m) { m = []; pools.set(key, m); } let p = m[buf]; if (!p) { p = []; m[buf] = p; } return p; };

const A = [], B = [], ratios = [];
let headSlower = 0, pairs = 0;
for (let rep = 0; rep < reps + warm; rep++) {
  for (const [type, distance, i] of CASES) {
    const e = actor(type, distance, i);
    const o = opts(distance);
    o.pool = poolFor(type + ':' + distance + ':' + i);
    let x, y, t;
    if ((rep + i) & 1) { t = now(); mods[1].build(e, o); y = now() - t; t = now(); mods[0].build(e, o); x = now() - t; }
    else { t = now(); mods[0].build(e, o); x = now() - t; t = now(); mods[1].build(e, o); y = now() - t; }
    if (rep < warm) continue;
    A.push(x / 1e6); B.push(y / 1e6); ratios.push(y / x); pairs++;
    if (y > x) headSlower++;
  }
}
const report = {
  banc: 'FActors.build apparié, réservoirs durables par cas, ordre alterné',
  node: process.version, cas: CASES.length, reps, warm,
  identiques: (CASES.length - mismatches) + ' / ' + CASES.length,
  A: {racine: roots[0], p50Ms: +q(A, .5).toFixed(5), p95Ms: +q(A, .95).toFixed(5), moyenneMs: +mean(A).toFixed(5)},
  B: {racine: roots[1], p50Ms: +q(B, .5).toFixed(5), p95Ms: +q(B, .95).toFixed(5), moyenneMs: +mean(B).toFixed(5)},
  ratioP50: +(q(B, .5) / q(A, .5)).toFixed(4),
  ratioP95: +(q(B, .95) / q(A, .95)).toFixed(4),
  ratioParPaire: +q(ratios, .5).toFixed(4),
  tetePlusLentePct: +(100 * headSlower / pairs).toFixed(1),
  controle: resolve(roots[0]) === resolve(roots[1])
};
console.log(JSON.stringify(report, null, 1));

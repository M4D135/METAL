// Coût CPU et nombre de pièces des colosses articulés (FActors.build) selon la distance (LOD).
import {load} from './lib.mjs';
const [root] = process.argv.slice(2);
const W = load(root, ['actors', 'effects']);
const rows = [];
for (const [kind, scale] of [['colossus', 5.4], ['siegebreaker', 7.2], ['custodian', 9]]) for (const distance of [8, 15, 25, 40, 70, 120]) for (const quality of ['high', 'low']) {
  const e = {id: 7, type: 3, x: 0, z: 0, y: 1.8 * scale, baseY: 0, bossScale: scale, bossKind: kind, hp: 100, maxHp: 100, yaw: .3, bossAwake: true, weakPointOpen: false, attackState: 'aim', windup: .5, windupMax: 1, moveSpeed: .8, hurt: .1, stun: 0, awareness: 'engage', aimX: 0, aimY: 0, aimZ: -20};
  let n = 0; const t0 = performance.now(), N = 400;
  for (let i = 0; i < N; i++) n = W.FActors.build(e, {time: i / 60, distance, quality, backend: 'webgl2'}).length;
  const us = (performance.now() - t0) / N * 1000;
  rows.push({kind, distance, quality, lod: W.FActors.build(e, {distance, quality})[0].actorLod, meshes: n, usPerBuild: +us.toFixed(1)});
}
for (const r of rows) console.log(JSON.stringify(r));
// Effets : télégraphes de boss (anneau, balayages, zones) — nombre de maillages produits.
const state = {time: 1, player: {x: 0, y: 0, z: 15}, bossAttacks: [
  {kind: 'ring', x: 0, y: 0, z: 0, warning: true, active: false, radius: 27, currentRadius: 0, innerRadius: 0},
  {kind: 'sweep', x: 0, y: 0, z: 0, warning: true, active: false, dx: 0, dz: 1, length: 30, width: 1.45},
  {kind: 'rocketZone', x: 2, y: 0, z: 15, warning: true, active: false, radius: 3.2},
  {kind: 'slam', x: 0, y: 0, z: 15, warning: false, active: true, radius: 4.3}], explosions: [], projectiles: [], debris: [], particles: []};
const fx = W.FEffects.build(state, {}, {pos: [0, 1.62, 15]}, {quality: 'high'});
console.log(JSON.stringify({effectsMeshes: fx.length, parts: [...new Set(fx.map(m => m.effectPart))]}));

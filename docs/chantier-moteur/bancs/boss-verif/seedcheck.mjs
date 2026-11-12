import {load} from '../boss/lib.mjs';
const W = load(process.argv[2]);
for (const idx of [0,1]) for (const seed of [96, 7, 2026, 1234]) {
  const w = W.FWorld.create(seed, idx, {campaign: true, campaignVersion: 2});
  const h = JSON.stringify([w.colliders.length, w.meshes.length, w.enemies.length, w.seed, w.bossArena]);
  console.log(idx, seed, 'w.seed=', w.seed, h.slice(0, 160));
}

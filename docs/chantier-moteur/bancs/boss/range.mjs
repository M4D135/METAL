// Maillages statiques dans le rayon de rendu depuis l'arène (portée étendue à 100 m par longViewZones).
import {load} from './lib.mjs';
const [root] = process.argv.slice(2); const W = load(root);
for (const index of [0, 1, 2]) {
  const w = W.FWorld.create(96, index, {campaign: true, campaignVersion: 2}), A = w.bossArena;
  for (const [label, x, z] of [['centre', A.x, A.z], ['entree', A.x - 24, A.z], ['bord-est', A.x + 24, A.z]]) {
    const row = {index, label};
    for (const r of [32, 54, 70, 90, 100]) row['r' + r] = w.meshes.filter(m => Math.hypot(m.p[0] - x, m.p[2] - z) < r + Math.max(m.s[0], m.s[2]) / 2).length;
    row.foliage = w.meshes.filter(m => Math.hypot(m.p[0] - x, m.p[2] - z) < 100 && (m.shape === 'foliage' || /tree|leaf|foliage|grass|shrub/.test(m.category || ''))).length;
    console.log(JSON.stringify(row));
  }
}

// Quel sol porte le point de couverture (-31.06, ±7) relatif à l'arène, derrière le mur ouest ?
import {load} from '../boss/lib.mjs';
const W = load(process.argv[2]);
for (const index of [0, 1, 2]) {
  const w = W.FWorld.create(96, index, {campaign: true, campaignVersion: 2}), A = w.bossArena;
  for (const dz of [7, -7]) {
    const x = A.x - 31.06, z = A.z + dz;
    const floors = (w.walkable || []).filter(f => Math.abs(x - f.x) <= f.w / 2 && Math.abs(z - f.z) <= f.d / 2).map(f => ({x: +(f.x - A.x).toFixed(1), z: +(f.z - A.z).toFixed(1), w: f.w, d: f.d, y: f.y, substrate: !!f.substrate, fallback: !!f.fallback, arenaPath: !!f.arenaPath}));
    console.log(JSON.stringify({index, point: [-31.06, dz], floors}));
  }
}

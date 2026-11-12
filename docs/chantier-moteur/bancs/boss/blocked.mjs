// Coût de blocked() : petit rayon (seau spatial) vs rayon de colosse (repli sur tous les solides).
import {load, loadout} from './lib.mjs';
const [root] = process.argv.slice(2); const W = load(root);
for (const index of [0, 2]) {
  const w = W.FWorld.create(96, index, {campaign: true, campaignVersion: 2}), sim = W.FSimulation.create(w, loadout(W, index)), A = w.bossArena;
  for (const r of [.4, 1.05, 1.2, 8.1, 13.5]) {
    const N = 20000; let hits = 0; const t0 = performance.now();
    for (let i = 0; i < N; i++) if (sim.blocked(A.x + (i % 17) * .3 - 2.5, A.z + (i % 13) * .3 - 2, r)) hits++;
    console.log(JSON.stringify({index, solids: w.colliders.length, r, usPerCall: +((performance.now() - t0) / N * 1000).toFixed(2), hits}));
  }
}

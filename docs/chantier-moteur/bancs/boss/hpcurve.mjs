// PV proposés : dégâts cumulés des N premières fenêtres (modèle idéal, munitions + ravitaillement arène),
// avec N(i) = 9 + i/2 fenêtres et un facteur de précision réaliste de 0,6.
import {readFileSync} from 'node:fs';
import {load, loadout} from './lib.mjs';
const [root] = process.argv.slice(2); const W = load(root);
const rows = readFileSync(new URL('./window-results.jsonl', import.meta.url), 'utf8').trim().split('\n').map(l => JSON.parse(l));
const table = [];
for (const r of rows) {
  const w = W.FWorld.create(96, r.index, {campaign: true, campaignVersion: 2}), A = w.bossArena, L = loadout(W, r.index), ammo = L.inventory.ammo.slice();
  for (const q of w.pickups) if (q.kind === 'ammo' && Math.abs(q.x - A.x) < 31 && Math.abs(q.z - A.z) < 31 && L.inventory.weapons[q.weapon]) ammo[q.weapon] += q.amount;
  const N = 9 + r.index / 2; let dmg = 0, k = 0;
  const seq = []; for (const wpn of [2, 1, 0]) { const per = r['w' + wpn], cost = r['ammo' + wpn]; if (!per || !cost) continue; while (ammo[wpn] >= cost) { seq.push(per); ammo[wpn] -= cost; } }
  for (; k < Math.floor(N); k++) dmg += k < seq.length ? seq[k] : r.w4;
  dmg += (N - Math.floor(N)) * (k < seq.length ? seq[k] : r.w4);
  const hp = Math.round(dmg * .6 / 50) * 50; table.push(hp);
  console.log(JSON.stringify({index: r.index, kind: r.kind, old: r.bossHp, windowsTarget: N, idealDamage: Math.round(dmg), proposed: hp, ratio: +(hp / r.bossHp).toFixed(2)}));
}
console.log(JSON.stringify(table));

// Modèle de durée de combat (TTK) limité par les munitions : fenêtres mesurées (window-results.jsonl)
// + munitions pleines + ravitaillement de l'arène ; ordre d'emploi : roquettes, double pompe, mitraillette, pistolet.
import {readFileSync} from 'node:fs';
import {load, loadout} from './lib.mjs';
const [root] = process.argv.slice(2); const W = load(root);
const rows = readFileSync(new URL('./window-results.jsonl', import.meta.url), 'utf8').trim().split('\n').map(l => JSON.parse(l));
const cycle = {'colosse': 6.73, 'brise-siège': 6.9, 'veilleur': 6.9}; // s par cycle attaque+fenêtre (mix.mjs, 15 m)
for (const r of rows) {
  const w = W.FWorld.create(96, r.index, {campaign: true, campaignVersion: 2}), A = w.bossArena, L = loadout(W, r.index);
  const ammo = L.inventory.ammo.slice();
  for (const q of w.pickups) if (q.kind === 'ammo' && Math.abs(q.x - A.x) < 31 && Math.abs(q.z - A.z) < 31 && L.inventory.weapons[q.weapon]) ammo[q.weapon] += q.amount;
  let hp = r.bossHp, windows = 0; const used = {};
  for (const wpn of [2, 1, 0]) { const per = r['w' + wpn], cost = r['ammo' + wpn]; if (!per || !cost) continue; while (hp > 0 && ammo[wpn] >= cost) { hp -= per; ammo[wpn] -= cost; windows++; used[wpn] = (used[wpn] || 0) + 1; } }
  while (hp > 0) { hp -= r.w4; windows++; used[4] = (used[4] || 0) + 1; }
  console.log(JSON.stringify({index: r.index, kind: r.kind, bossHp: r.bossHp, windows, windowsByWeapon: used, ttkS: Math.round(windows * cycle[r.kind]), pistolShare: +((used[4] || 0) / windows).toFixed(2)}));
}

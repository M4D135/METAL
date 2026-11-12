// Niveau réel des sons de boss au joueur (FSoundscape), sans occlusion, selon la distance au colosse.
import {readFileSync} from 'node:fs'; import vm from 'node:vm';
const root = process.argv[2]; const ctx = {window: {}, Math}; vm.createContext(ctx);
vm.runInContext(readFileSync(root + '/src/soundscape.js', 'utf8'), ctx);
const SC = ctx.window.FSoundscape.create();
const gains = {bossTell: .09, bossImpact: .58, bossRoar: .39, explosion: .75}; // gain principal de chaque synthèse (audio.js)
for (const [name, scale] of [['colosse', 5.4], ['brise-siege', 7.2], ['veilleur', 9]]) for (const d of [10, 15, 20, 25]) {
  const sim = {state: {time: 1, player: {x: d, y: 0, z: 0, yaw: -Math.PI / 2}, doors: []}, ray: (o, dir, far) => far, destruction: {revision: 0}};
  const row = {boss: name, d};
  for (const ev of ['bossTell', 'bossImpact', 'bossRoar']) { const m = SC.event(sim, {name: ev, x: 0, y: 1.8 * scale, z: 0}); row[ev] = +m.level.toFixed(3); row[ev + 'Gain'] = +(m.level * gains[ev]).toFixed(4); }
  // Impact d'écrasement : au pied du joueur (zone ciblée) — référence d'un son proche.
  const near = SC.event(sim, {name: 'explosion', x: d, y: .2, z: 0}); row.slamExplosionGain = +(near.level * gains.explosion).toFixed(3);
  console.log(JSON.stringify(row));
}

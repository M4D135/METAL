// Banc BOSS — chargement hors navigateur (lecture seule du dépôt) et outils communs.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

export function load(root, extra = []) {
  const ctx = {window: {}, performance, console, Math, Date};
  vm.createContext(ctx);
  for (const n of ['renderer', 'world', 'destruction', 'economy', 'brain', 'simulation', ...extra])
    vm.runInContext(readFileSync(root + '/src/' + n + '.js', 'utf8'), ctx, {filename: n + '.js'});
  return ctx.window;
}

// Chargement d'une progression plausible au monde `index` (0..17) de la campagne v2 :
// toutes les récompenses de boss précédentes encaissées, munitions pleines.
export function loadout(W, index, {ammoFraction = 1, shopRanks = null} = {}) {
  const E = W.FEconomy;
  let profile = E.fresh({campaignVersion: 2});
  const weapons = [false, false, false, false, true];
  for (let i = 0; i < index; i++) {
    profile = E.grantBossReward(profile, i);
    const r = E.bossReward(i);
    if (r.weapon !== null) weapons[r.weapon] = true;
  }
  if (shopRanks) for (const [k, v] of Object.entries(shopRanks)) profile.upgrades[k] = Math.min(12, profile.upgrades[k] + v);
  const caps = E.ammoCaps(profile, {campaign: true});
  const ammo = caps.map((c, i) => (weapons[i] ? (i === 4 ? 1 : Math.floor(c * ammoFraction)) : 0));
  return {
    inventory: {weapons, ammo, shield: true},
    economy: profile,
    campaign: {version: 2, discovered: ['pistol', 'shield', ...(weapons[0] ? ['smg'] : []), ...(weapons[1] ? ['shotgun'] : []), ...(weapons[3] ? ['grenade'] : []), ...(weapons[2] ? ['rocket'] : [])],
      claimedBossRewards: Array.from({length: index}, (_, i) => i)},
  };
}

export function stats(times) {
  const t = times.slice().sort((a, b) => a - b), q = p => t[Math.min(t.length - 1, Math.floor(t.length * p))];
  const sum = t.reduce((a, b) => a + b, 0);
  return {steps: t.length, avg: +(sum / t.length).toFixed(3), p50: +q(.5).toFixed(3), p95: +q(.95).toFixed(3), p99: +q(.99).toFixed(3), max: +t[t.length - 1].toFixed(2),
    over4: t.filter(v => v > 4).length, over8: t.filter(v => v > 8).length, over16: t.filter(v => v > 16).length};
}

export const corePoint = e => ({x: e.x + Math.sin(e.yaw) * .9 * e.bossScale, y: e.baseY + 1.93 * e.bossScale, z: e.z - Math.cos(e.yaw) * .9 * e.bossScale});
export function aimAt(p, x, y, z) { const dx = x - p.x, dz = z - p.z; p.yaw = Math.atan2(dx, -dz); p.pitch = Math.atan2(y - p.y - 1.62, Math.hypot(dx, dz)); }

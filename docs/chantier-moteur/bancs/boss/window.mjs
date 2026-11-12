// Dégâts par fenêtre de cœur exposé, par arme et par monde (progression v2 complète des récompenses).
// Boss figé (pas d'attaque), cœur ouvert pendant weakTimer (3 / 2,7 / 2,4 s), joueur à 15 m, tir continu.
// Régime établi : 6 cycles fenêtre + pause de 4 s (refroidissement) ; on rapporte la moyenne par fenêtre.
import {load, loadout, corePoint, aimAt} from './lib.mjs';
const [root] = process.argv.slice(2); const W = load(root), dt = 1 / 60, rows = [];
for (let index = 0; index < 18; index++) {
  const row = {index, kind: ['colosse', 'brise-siège', 'veilleur'][index % 3]};
  for (const weapon of [4, 0, 1, 2]) {
    const world = W.FWorld.create(96, index, {campaign: true, campaignVersion: 2}), L = loadout(W, index);
    if (!L.inventory.weapons[weapon]) { row['w' + weapon] = null; continue; }
    const sim = W.FSimulation.create(world, {...L});
    const s = sim.state, p = s.player, A = world.bossArena, boss = s.enemies.find(e => e.type === 3 && e.bossScale > 1);
    Object.assign(p, {x: A.x - 15, y: A.y, z: A.z}); sim.step(0, {}); sim.selectWeapon(weapon);
    const win = boss.bossKind === 'colossus' ? 3 : boss.bossKind === 'siegebreaker' ? 2.7 : 2.4;
    let dealt = 0, used = 0; const ammo0 = s.inventory.ammo[weapon];
    for (let c = 0; c < 6; c++) {
      for (let i = 0; i < (win + 4) / dt; i++) {
        const open = i * dt < win; boss.bossClock = 99; boss.weakTimer = open ? 99 : 0; boss.weakPointOpen = open; s.bossAttacks.length = 0;
        const c0 = corePoint(boss); aimAt(p, c0.x, c0.y, c0.z);
        const hp0 = boss.hp; sim.step(dt, {fire: open}); p.hp = s.maxHp; boss.hp = Math.max(boss.hp, 1); if (open) dealt += hp0 - boss.hp; boss.hp = boss.maxHp;
        // Les projectiles en vol après la fenêtre ne comptent pas (le cœur se referme).
        s.events.length = 0;
      }
    }
    used = ammo0 - s.inventory.ammo[weapon];
    row['w' + weapon] = Math.round(dealt / 6); row['ammo' + weapon] = +(used / 6).toFixed(1);
  }
  const best = Math.max(...[4, 0, 1, 2].map(w => row['w' + w] || 0));
  const hp = [600, 850, 1200, 1550, 1900, 2400, 2900, 3400, 4000, 4650, 5300, 6050, 6850, 7700, 8600, 9600, 10800, 12000][index];
  row.bossHp = hp; row.bestPerWindow = best; row.windowsNeeded = +(hp / best).toFixed(1);
  rows.push(row); console.log(JSON.stringify(row));
}

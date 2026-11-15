// Exact historical skilled driver; only observability/timing is separate.
import {loadout,corePoint,aimAt} from '/home/m4d135/metal-chantier/voies/sim2/docs/chantier-moteur/bancs/boss/lib.mjs';
export function createFight(loaded,index,seedArg=96){
 const W=loaded.window,policy='skilled',keepShield=false,dt=1/60;
 const world = W.FWorld.create(+seedArg, index, {campaign: true, campaignVersion: 2});
const L = loadout(W, index, process.env.SHOP ? {shopRanks: JSON.parse(process.env.SHOP)} : {});
if (!keepShield) L.equipment = undefined;
delete L.inventory.shield;L.campaign.discovered=L.campaign.discovered.filter(x=>x!=='shield');
const sim = W.FSimulation.create(world, {brain: W.FBrain.create({mode: 'cpu'}), ...L});
if (!keepShield) { /* main gauche libre : la touche d'esquive redevient un dash */ sim.state.equipment.left = null; }
const s = sim.state, p = s.player, A = world.bossArena, boss = s.enemies.find(e => e.type === 3 && e.bossScale > 1);
// Entrée : couloir ouest (ouverture unique de l'arène), puis quelques mètres dans l'arène.
Object.assign(p, {x: A.x - 24, y: A.y, z: A.z + .3, yaw: Math.PI / 2, pitch: 0});
sim.step(0, {});
s.events.length = 0;


 let strafe=1;const weapons=s.inventory.weapons;
 const dist2=(ax,az,bx,bz)=>Math.hypot(ax-bx,az-bz);
 function dangerVector() {
  // Retourne une direction d'évasion pour les zones signalées (comportement d'un joueur attentif).
  let best = null;
  for (const a of s.bossAttacks) {
    // Une zone de roquettes reste dangereuse tant que sa roquette n'a pas explosé.
    const rocketPending = a.kind === 'rocketZone' && a.active && (!a.fired || s.projectiles.some(q => q.owner === a.bossId && Math.hypot(q.x - a.x, q.z - a.z) < 40));
    if (!a.warning && !rocketPending && !(a.active && (a.kind === 'ring' || a.kind === 'sweep'))) continue;
    if (a.kind === 'slam' || a.kind === 'rocketZone') {
      const d = dist2(p.x, p.z, a.x, a.z); if (d < a.radius + 1.4) { const n = Math.max(.01, d); best = {x: (p.x - a.x) / n, z: (p.z - a.z) / n, urgency: a.tell - a.age, kind: a.kind}; }
    } else if (a.kind === 'sweep') {
      const dx = p.x - a.x, dz = p.z - a.z, along = Math.max(0, Math.min(a.length, dx * a.dx + dz * a.dz)), ox = dx - a.dx * along, oz = dz - a.dz * along, off = Math.hypot(ox, oz);
      if (off < a.width + 1.4) { const side = Math.sign(dx * a.dz - dz * a.dx) || 1; best = {x: a.dz * side, z: -a.dx * side, urgency: a.tell - a.age, kind: 'sweep'}; }
    } else if (a.kind === 'ring' && a.active) {
      const d = dist2(p.x, p.z, a.x, a.z); if (d > a.innerRadius - .5 && d < a.currentRadius + 2.2) best = {x: 0, z: 0, urgency: 0, kind: 'ring', ringFront: a.currentRadius - d};
    }
  }
  return best;
}
function pickWeapon(open, d) {
  const ammo = s.inventory.ammo;
  if (policy === 'pistol') return 4;
  if (policy === 'max') {
    if (!open) return weapons[0] && ammo[0] > 0 ? 0 : 4;
    if (weapons[2] && ammo[2] > 0 && p.heat < .45 && (s.weaponCooldowns?.[2] ?? 0) <= 0) return 2;
    if (weapons[1] && ammo[1] > 0 && d < 20) return 1;
    if (weapons[0] && ammo[0] > 0) return 0;
    return 4;
  }
  if (open) {
    if (weapons[1] && ammo[1] > 0 && d < 18) return 1;
    if (weapons[2] && ammo[2] > 0) return 2;
    if (weapons[0] && ammo[0] > 0) return 0;
    if (weapons[1] && ammo[1] > 0) return 1;
    return 4;
  }
  if (weapons[0] && ammo[0] > 60) return 0;
  return 4;
}

 return {sim,state:s,boss,prepare(i){  const t = i * dt, input = {moveX: 0, moveY: 0, sprint: true, fire: false, fireLeft: false, dash: false};
  const open = boss.weakPointOpen, target = open ? corePoint(boss) : {x: boss.x, y: boss.baseY + 2.0 * boss.bossScale, z: boss.z};
  const d = dist2(p.x, p.z, boss.x, boss.z), fromCentre = dist2(p.x, p.z, A.x, A.z);
  // Cible : gardes libérés proches d'abord (ils tirent), sinon le colosse.
  const guard = s.enemies.filter(e => e.bossWave && e.bossReleased && e.hp > 0 && e.deployed !== false && dist2(e.x, e.z, p.x, p.z) < 24).sort((a, b) => dist2(a.x, a.z, p.x, p.z) - dist2(b.x, b.z, p.x, p.z))[0];
  if (policy !== 'static' && guard && !open) aimAt(p, guard.x, guard.y, guard.z); else aimAt(p, target.x, target.y, target.z);
  const w = pickWeapon(open, d); if (s.weapon !== w && weapons[w]) sim.selectWeapon(w);
  input.fire = policy === 'max' ? (open || !!guard) : true;
  // Déplacement : orbite autour du colosse à ~15 m en restant dans le cercle d'engagement (r=28).
  let mx = 0, mz = 0;
  if (policy === 'corner') {
    // Reste derrière la couverture nord-est (hors du cercle de 28 m) et tire.
    const gx = A.x + 27.6, gz = A.z + 21; mx = gx - p.x; mz = gz - p.z; const n = Math.hypot(mx, mz); if (n > .3) { mx /= n; mz /= n; } else mx = mz = 0;
  } else if (policy !== 'static') {
    const rx = p.x - boss.x, rz = p.z - boss.z, rn = Math.max(.01, Math.hypot(rx, rz));
    const radial = (15 - rn) / 4; let tx = -rz / rn * strafe, tz = rx / rn * strafe;
    mx = tx + rx / rn * radial; mz = tz + rz / rn * radial;
    if (fromCentre > 24) { mx += (A.x - p.x) / fromCentre * 1.5; mz += (A.z - p.z) / fromCentre * 1.5; }
    if (i % 300 === 0) strafe = -strafe;
    const danger = dangerVector();
    if (danger && danger.kind !== 'ring') { mx = danger.x * 2 + mx * .3; mz = danger.z * 2 + mz * .3; }
    if (danger && danger.kind === 'ring' && danger.ringFront > -1.4 && danger.ringFront < .2 && (process.env.FIXBOT || s.equipment?.left !== 'shield') && p.dash <= 0) input.dash = true;
    if (danger && danger.kind !== 'ring' && danger.urgency < .35 && (process.env.FIXBOT || s.equipment?.left !== 'shield') && p.dash <= 0) input.dash = true;
    const n = Math.hypot(mx, mz); if (n > 1) { mx /= n; mz /= n; }
  }
  const cy = Math.cos(p.yaw), sy = Math.sin(p.yaw); input.moveX = mx * cy + mz * sy; input.moveY = mx * sy - mz * cy;
  // Bouclier : levé si une roquette du colosse approche et que l'arme est en recharge.
  if (keepShield && s.equipment?.left === 'shield') {
    const incoming = s.projectiles.some(q => q.owner === boss.id && Math.hypot(q.x - p.x, q.y - p.y - 1, q.z - p.z) < 9);
    if (incoming) input.fireLeft = true;
    if (process.env.FIXBOT) { const dg = dangerVector(); if (dg && dg.kind === 'ring' && dg.ringFront > -4 && dg.ringFront < .4 && !input.dash && p.dashing <= 0) input.fireLeft = true; if (input.dash) input.fireLeft = false; }
  }

return input;},after(){if(!s.dead)p.hp=s.maxHp;s.events.length=0;},dispose(){sim.dispose?.();},done(){return s.dead||boss.hp<=0;}};
}

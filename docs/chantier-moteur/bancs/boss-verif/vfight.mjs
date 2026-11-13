// Banc BOSS : combat scripté de 60 s (défaut) contre le colosse d'un monde de campagne v2.
// usage : node fight.mjs <ferro> [index=0] [seconds=60] [policy=skilled|pistol|static|corner] [shield=1|0] [seed=96]
// Mesure le coût de chaque sim.step (performance.now), attribue les pointes aux événements du pas,
// et relève la dynamique du combat (attaques, dégâts reçus par famille, fenêtres du cœur, phases).
import {loadout, stats, corePoint, aimAt} from '../boss/lib.mjs';
import {loadPatched} from './vlib.mjs';
import {PATCHES} from './patches.mjs';
import inspector from 'node:inspector';
const PROFILE_STEP = process.env.PROFILE_STEP === undefined ? -1 : +process.env.PROFILE_STEP;
const session = PROFILE_STEP >= 0 ? new inspector.Session() : null; if (session) session.connect();
const post = (m, q) => new Promise((res, rej) => session.post(m, q, (e, r) => e ? rej(e) : res(r)));
if (session) { await post('Profiler.enable'); await post('Profiler.setSamplingInterval', {interval: 50}); }
function report(profile) {
  const nodes = new Map(profile.nodes.map(n => [n.id, n])), self = new Map(), parent = new Map();
  profile.samples.forEach((id, k) => self.set(id, (self.get(id) || 0) + profile.timeDeltas[k]));
  for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const incl = new Map(), selfBy = new Map();
  for (const [id, t] of self) { const seen = new Set(); let cur = id; const cf0 = nodes.get(id).callFrame, k0 = (cf0.functionName || '(anon)') + ' ' + cf0.url.split('/').pop() + ':' + (cf0.lineNumber + 1); selfBy.set(k0, (selfBy.get(k0) || 0) + t);
    while (cur !== undefined) { const cf = nodes.get(cur).callFrame, key = (cf.functionName || '(anon)') + ' ' + cf.url.split('/').pop() + ':' + (cf.lineNumber + 1); if (!seen.has(key)) { seen.add(key); incl.set(key, (incl.get(key) || 0) + t); } cur = parent.get(cur); } }
  console.error('INCLUSIVE'); for (const [k, t] of [...incl].sort((a, b) => b[1] - a[1]).slice(0, +(process.env.TOPN || 22))) console.error((t / 1000).toFixed(2) + 'ms', k);
  console.error('SELF'); for (const [k, t] of [...selfBy].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.error((t / 1000).toFixed(2) + 'ms', k);
}
const [root, idxArg = '0', secArg = '60', policy = 'skilled', shieldArg = '1', seedArg = '96'] = process.argv.slice(2);
const index = +idxArg, seconds = +secArg, keepShield = shieldArg !== '0', HZ = 60, dt = 1 / HZ;
const W = loadPatched(root, PATCHES(process.env.VARIANT || 'probe'));
if (process.env.BOUNDED) W.__bound = true; if (process.env.NOWIPE) W.__nowipe = true; if (process.env.SLEEP) W.__sleep = true; if (process.env.SOLIDONLY) W.__solidOnly = true;
W.__diag = {log: []};
const world = W.FWorld.create(+seedArg, index, {campaign: true, campaignVersion: 2});
const L = loadout(W, index);
if (!keepShield) L.equipment = undefined;
const sim = W.FSimulation.create(world, {brain: W.FBrain.create({mode: 'cpu'}), ...L});
if (!keepShield) { /* main gauche libre : la touche d'esquive redevient un dash */ sim.state.equipment.left = null; }
const s = sim.state, p = s.player, A = world.bossArena, boss = s.enemies.find(e => e.type === 3 && e.bossScale > 1);
// Entrée : couloir ouest (ouverture unique de l'arène), puis quelques mètres dans l'arène.
Object.assign(p, {x: A.x - 24, y: A.y, z: A.z + .3, yaw: Math.PI / 2, pitch: 0});
sim.step(0, {});
s.events.length = 0;

const times = [], spikes = [], log = {attacks: {}, hitsTaken: {}, damageTaken: {}, shieldAbsorbed: 0, armorStart: s.armor?.points, dmgBody: 0, dmgWeak: 0,
  openTime: 0, phaseAt: [], awakeAt: null, deathAt: null, guardsReleasedAt: [], shots: 0, hpMin: p.hp, playerDeadAt: null, outOfCircle: 0, bossMoves: 0};
let lastHurtKind = null, strafe = 1, lastX = boss.x, lastZ = boss.z;
const weapons = s.inventory.weapons;
const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
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
const hpBefore = () => p.hp;
for (let i = 0; i < seconds * HZ && !s.dead && boss.hp > 0; i++) {
  const t = i * dt, input = {moveX: 0, moveY: 0, sprint: true, fire: false, fireLeft: false, dash: false};
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
    if (danger && danger.kind === 'ring' && danger.ringFront > -1.4 && danger.ringFront < .2 && s.equipment?.left !== 'shield' && p.dash <= 0) input.dash = true;
    if (danger && danger.kind !== 'ring' && danger.urgency < .35 && s.equipment?.left !== 'shield' && p.dash <= 0) input.dash = true;
    const n = Math.hypot(mx, mz); if (n > 1) { mx /= n; mz /= n; }
  }
  const cy = Math.cos(p.yaw), sy = Math.sin(p.yaw); input.moveX = mx * cy + mz * sy; input.moveY = mx * sy - mz * cy;
  // Bouclier : levé si une roquette du colosse approche et que l'arme est en recharge.
  if (keepShield && s.equipment?.left === 'shield') {
    const incoming = s.projectiles.some(q => q.owner === boss.id && Math.hypot(q.x - p.x, q.y - p.y - 1, q.z - p.z) < 9);
    if (incoming) input.fireLeft = true;
  }
  const hp0 = p.hp, shield0 = s.shield?.energy, armor0 = s.armor?.points, bossHp0 = boss.hp, phase0 = boss.phase;
  const hitBefore = new Set(s.bossAttacks.filter(a => a.hitPlayer).map(a => a.id));
  const counts0 = {proj: s.projectiles.length, expl: s.explosions.length, debris: s.debris.length, attacks: s.bossAttacks.length};
  if (i === PROFILE_STEP || PROFILE_STEP === 99999 && i === 0) await post('Profiler.start');
  const c0 = process.threadCpuUsage(); const t0 = performance.now(); sim.step(dt, input); const ms = performance.now() - t0; const cu = process.threadCpuUsage(c0); (globalThis.__cpu ||= []).push({i, t: +(i*dt).toFixed(2), cpu: (cu.user + cu.system) / 1000, ms});
  if (i === PROFILE_STEP) { const {profile} = await post('Profiler.stop'); console.error('profiled step', i, ms.toFixed(1), 'ms'); report(profile); }
  times.push(ms);
  const ev = s.events.map(e => e.name + (e.kind !== undefined ? ':' + e.kind : ''));
  if (!log.nav) log.nav = {revisions: 0, pumpSteps: 0, breaks: {}, maxDebris: 0, structural: 0, navCells: sim.nav.cells.length, lastRevision: sim.destruction?.revision ?? 0};
  if ((s.aiStats.navUpdates || 0) > 0) log.nav.pumpSteps++;
  if ((sim.destruction?.revision ?? 0) !== log.nav.lastRevision) { log.nav.revisions++; log.nav.lastRevision = sim.destruction.revision; (log.nav.revAt ||= []).push(+t.toFixed(2)); }
  for (const e of s.events) if (e.name === 'materialBreak') { const key = String(e.sourceId).replace(/[0-9]+/g, '#'); log.nav.breaks[key] = (log.nav.breaks[key] || 0) + 1; }
  log.nav.maxDebris = Math.max(log.nav.maxDebris, s.debris.length); log.nav.structural = s.debris.filter(q => q.structural).length;
  const routeLog = (W.__log || []).splice(0); (W.__allRoutes ||= []).push(...routeLog);
  if (ms > 8) spikes.push({i, t: +t.toFixed(2), ms: +ms.toFixed(1), ev: [...new Set(ev)].slice(0, 12), debris: s.debris.length, proj: s.projectiles.length, attacks: s.bossAttacks.length, routes: routeLog.filter(r => r.ms > 1), aiStats: {...s.aiStats}});
  for (const e of s.events) {
    if (e.name === 'bossTell') log.attacks[e.kind] = (log.attacks[e.kind] || 0) + 1;
    if (e.name === 'bossRoar' && log.awakeAt === null) log.awakeAt = +t.toFixed(2);
    if (e.name === 'bossPhase') log.phaseAt.push(+t.toFixed(2));
    if (e.name === 'bossDeath') log.deathAt = +t.toFixed(2);
    if (e.name === 'shieldBlock') log.shieldAbsorbed += e.absorbed;
    if (e.name === 'shot' || e.name === 'fracture' || e.name === 'rocket' && e.owner === 'player') log.shots++;
  }
  if (p.hp < hp0 || (s.armor && s.armor.points < armor0)) {
    // Attribution : attaque de boss active ce pas-ci, sinon autre (gardes, débris...).
    const act = s.bossAttacks.find(a => a.hitPlayer && !hitBefore.has(a.id)) || null;
    const ex = s.events.find(e => e.name === 'explosion' && Math.hypot(e.x - p.x, e.z - p.z) < (e.radius || 4) + 1);
    const bullet = s.events.find(e => e.name === 'hurt');
    const kind = act ? act.kind : ex ? (ex.owner === boss.id ? (ex.kind === 'rocket' ? 'rocketZone' : 'slam') : 'blast-' + ex.kind + '-' + ex.owner) : 'guards/other';
    if (!log.hitLog) log.hitLog = []; if (log.hitLog.length < 40) log.hitLog.push({t: +t.toFixed(2), kind, lost: +((hp0 - p.hp) + ((armor0 ?? 0) - (s.armor?.points ?? 0))).toFixed(1), d: +d.toFixed(1), fromCentre: +fromCentre.toFixed(1), shield: s.equipment?.left, dashing: p.dashing > 0});
    const lost = (hp0 - p.hp) + ((armor0 ?? 0) - (s.armor?.points ?? 0));
    log.hitsTaken[kind] = (log.hitsTaken[kind] || 0) + 1; log.damageTaken[kind] = +((log.damageTaken[kind] || 0) + lost).toFixed(1);
  }
  const dealt = bossHp0 - boss.hp; if (dealt > 0) { if (open) log.dmgWeak += dealt; else log.dmgBody += dealt; }
  if (open) log.openTime += dt;
  if (fromCentre >= A.r) log.outOfCircle += dt;
  log.bossMoves += Math.hypot(boss.x - lastX, boss.z - lastZ); lastX = boss.x; lastZ = boss.z;
  log.hpMin = Math.min(log.hpMin, p.hp);
  if (s.dead && log.playerDeadAt === null) log.playerDeadAt = +t.toFixed(2);
  if (process.env.GOD && !s.dead) p.hp = s.maxHp;
  s.events.length = 0;
}
if (PROFILE_STEP === 99999) { const {profile} = await post('Profiler.stop'); console.error('whole fight profile'); report(profile); }
const st = stats(times); { const C = globalThis.__cpu; const cs = stats(C.map(c => c.cpu)); console.error('CPU', JSON.stringify(cs), JSON.stringify(C.slice().sort((a, b) => b.cpu - a.cpu).slice(0, 6).map(c => ({t: c.t, cpu: +c.cpu.toFixed(1), ms: +c.ms.toFixed(1)})))); }
{const R = W.__allRoutes || []; console.error('TIMERS', JSON.stringify(Object.fromEntries(Object.entries(W.__T || {}).map(([k, v]) => [k, +v.toFixed(1)]))), 'DEB', JSON.stringify(W.__deb)); console.error('REFRESH', JSON.stringify(W.__refresh || [])); console.error('REV', JSON.stringify(W.__rev || [])); console.error('ROUTES', JSON.stringify({n: R.length, failed: R.filter(r => !r.found).length, totalMs: +R.reduce((a, r) => a + r.ms, 0).toFixed(1), explored: R.reduce((a, r) => a + r.explored, 0), worst: R.sort((a, b) => b.ms - a.ms).slice(0, 4).map(r => ({...r, toRel: [+(r.to[0] - A.x).toFixed(2), +(r.to[1] - A.z).toFixed(2)], fromRel: [+(r.from[0] - A.x).toFixed(1), +(r.from[1] - A.z).toFixed(1)]}))}));}
console.log(JSON.stringify({index, kind: boss.bossKind, policy, shield: keepShield, seed: seedArg, simSeconds: +(times.length * dt).toFixed(2), perf: st,
  topSpikes: spikes.sort((a, b) => b.ms - a.ms).slice(0, 8),
  fight: {...log, dmgBody: +log.dmgBody.toFixed(1), dmgWeak: +log.dmgWeak.toFixed(1), openTime: +log.openTime.toFixed(2), outOfCircle: +log.outOfCircle.toFixed(1), bossMoves: +log.bossMoves.toFixed(1),
    shieldAbsorbed: +log.shieldAbsorbed.toFixed(1), bossHpLeft: +boss.hp.toFixed(1), bossMaxHp: boss.maxHp, bossPhase: boss.phase, playerHp: +p.hp.toFixed(1), armor: s.armor?.points, ammo: s.inventory.ammo, heat: +p.heat.toFixed(2)}}, null, 1));

// Banc MIX — enregistre les flux réels d'appels audio de 4 scènes de 30 s (vraie simulation METAL 673d6b2,
// vrai FSoundscape, même répartition que game.js:193-203 et :697-703). Lecture seule du dépôt.
// usage : node record.mjs <racine METAL> <dossier de sortie>   -> écrit scenes.js (window.SCENES=...)
import {readFileSync, writeFileSync} from 'node:fs';
import vm from 'node:vm';
const [root, outDir] = process.argv.slice(2);
const win = {}; globalThis.window = win;
for (const n of ['renderer', 'world', 'destruction', 'economy', 'brain', 'simulation', 'soundscape'])
  vm.runInThisContext(readFileSync(root + '/src/' + n + '.js', 'utf8'), {filename: n + '.js'});
const {FWorld, FSimulation, FBrain, FEconomy, FSoundscape} = win;
const HZ = 60, DT = 1 / HZ;
const KEEP = ['level', 'pan', 'occluded', 'hand', 'seed', 'weapon', 'material', 'energy', 'power', 'mass', 'kind', 'radius', 'owner', 'intensity', 'tier', 'absorbed', 'broken', 'hit', 'count', 'actor', 'impact', 'outdoor', 'phase', 'distance'];
const AUDIO = new Set(('materialImpact materialBreak debrisLand horror metallicSlam horrorSting powerCut alarm rocket grenade grenadeLaunch shieldRaise shieldBlock shieldBash explosion pipeLeak creak trap bossTell bossRoar bossImpact bossDeath shot fracture pulse switchWeapon dash alerted enemyShot bossPhase hit hurt kill pickup ammoPickup weaponPickup trophy empty melee wave core mechanism jumpPad land liftStart liftStop').split(' '));
const r3 = v => typeof v === 'number' ? Math.round(v * 1e4) / 1e4 : v;

function recorder(sim, world, stage) {
  const sc = FSoundscape.create(), s = sim.state, frames = [], hist = {}, levels = {};
  let outdoorMix = 0, lastFootstep = 0;
  const isOutdoors = (x, z) => (world?.environment?.outdoorZones || []).some(a => Math.abs(x - a.x) <= a.w / 2 && Math.abs(z - a.z) <= a.d / 2);
  return {
    frames, hist, levels,
    // à appeler après chaque sim.step, avant de vider s.events (game.js:193-203 puis :697-703)
    capture() {
      const calls = [];
      const trophyIds = new Set(s.events.filter(e => e.name === 'trophy' || e.name === 'bossReward').map(e => e.id));
      for (const e of s.events) {
        const sound = e.name === 'bossReward' ? 'weaponPickup' : e.name === 'waveStart' ? 'wave' : e.name === 'armorPickup' ? 'ammoPickup' : e.name === 'lootPickup' ? (e.boss ? 'weaponPickup' : 'ammoPickup') : e.name;
        if (e.name === 'win' || !AUDIO.has(sound) || ((e.name === 'weaponPickup' || e.name === 'shieldPickup' || e.name === 'lootPickup') && trophyIds.has(e.id))) continue;
        const mix = sc.event(sim, e); if (!(mix.level > .0001)) continue;
        const o = {}; for (const k of KEEP) if (mix[k] !== undefined && mix[k] !== null) o[k] = r3(mix[k]);
        calls.push([sound, o]); hist[sound] = (hist[sound] || 0) + 1; (levels[sound] ||= []).push(mix.level);
      }
      const p = s.player, loc = s.locomotion, footstep = Math.floor((loc?.stridePhase || 0) / Math.PI), outside = isOutdoors(p.x, p.z);
      outdoorMix += (Number(outside) - outdoorMix) * (1 - Math.exp(-DT * 3));
      const local = sc.sample(sim), m = local.machinery, st = local.steam;
      const state = [r3(outdoorMix), r3(m.level), r3(m.pan), m.kind, r3(m.occluded), r3(st.level), r3(st.pan), r3(st.occluded), r3(s.threat || 0), r3(s.director?.pressure || 0)];
      let step = null;
      if (!p.airborne && footstep !== lastFootstep && s.moving > .5 && (loc?.dashBlend || 0) < .3) { step = [r3(s.moving), outside ? 1 : 0]; hist.step = (hist.step || 0) + 1; }
      lastFootstep = footstep;
      frames.push({c: calls, s: state, f: step});
    },
    result(name, label, from = 0, to = frames.length) {
      const fr = frames.slice(from, to);
      return {name, label, stage, env: {wind: world?.environment?.wind, biome: world?.environment?.biome}, frames: fr};
    }
  };
}
const brain = () => { try { return FBrain.create({mode: 'cpu'}); } catch (_) { return null; } };
function summarize(tag, rec, from = 0, to = rec.frames.length) {
  const h = {}; let n = 0, maxPerFrame = 0;
  for (const f of rec.frames.slice(from, to)) { maxPerFrame = Math.max(maxPerFrame, f.c.length); for (const [name] of f.c) { h[name] = (h[name] || 0) + 1; n++; } if (f.f) h.step = (h.step || 0) + 1; }
  console.log(tag, 'frames', to - from, 'appels', n, 'max/image', maxPerFrame, JSON.stringify(h));
}

// ---------- (a) rafales de SMG, monde classique 0 (« Fer noir », 100 bpm) ----------
function sceneA() {
  const world = FWorld.create(96, 0);
  const sim = FSimulation.create(world, {armorSystem: true, brain: brain(), inventory: {weapons: [true, true, true], ammo: [180, 36, 12]}});
  const s = sim.state, rec = recorder(sim, world, world.stage || 0), input = {moveX: 0, moveY: 1, sprint: true, fire: false, lookX: 0, lookY: 0, weapon: 0};
  let bursts = [], firing = false;
  for (let i = 0; i < 30 * HZ; i++) {
    const t = i * DT;
    input.moveX = Math.sin(t * .667); input.fire = (t % 3) < 1.6; input.weapon = 0; input.lookX = .6 * DT; input.dash = false;
    if (input.fire && !firing) bursts.push([i]); if (!input.fire && firing) bursts.at(-1).push(i); firing = input.fire;
    sim.step(DT, input); rec.capture(); s.events.length = 0;
    s.player.hp = s.maxHp || 100; s.inventory.ammo[0] = 180; if (s.dead) s.dead = false;
  }
  summarize('(a)', rec); const out = rec.result('a', 'Rafales de SMG sur « Fer noir » (monde classique 0, graine 96)'); out.bursts = bursts; return out;
}
// ---------- (b) pompe + 6 ennemis qui tirent (monde plat, ennemis maintenus en vie) ----------
function sceneB() {
  const layout = [[-4, -10, 0], [0, -12, 2], [4, -9, 0], [-9, -4, 1], [9, -5, 0], [2, -15, 2]];
  const world = {seed: 'mix', stage: 1, generation: 6, spawn: {x: 0, y: 0, z: 0, yaw: 0}, bounds: {minX: -40, maxX: 40, minZ: -40, maxZ: 40},
    walkable: [{x: 0, y: 0, z: 0, w: 80, d: 80}], meshes: [], lights: [], colliders: [], pickups: [], cores: [{x: 25, z: 25}, {x: 28, z: 25}, {x: 31, z: 25}], exit: {x: 34, z: 25},
    enemies: layout.map(([x, z, type]) => ({x, z, type})),
    progression: {version: 1, weaponSlots: 4, startWeapons: [true, true, true, true], startAmmo: [180, 36, 12, 16], startShield: false, ammoCaps: [180, 36, 12, 16], maxActive: 8}};
  const sim = FSimulation.create(world, {equipment: {right: 1, left: null, shieldEnergy: 100}, armorSystem: true, armor: {version: 1, points: 0}, brain: brain()});
  const s = sim.state, p = s.player, rec = recorder(sim, world, 1); p.yaw = 0; p.pitch = 0;
  sim.selectWeapon(1); for (const e of s.enemies) { e.hp = 1e6; e.maxHp = 1e6; }
  for (let i = 0; i < 30 * HZ; i++) {
    const t = i * DT, input = {moveX: Math.sin(t * 1.3) * .6, moveY: 0, fire: true, weapon: 1, lookX: Math.sin(t * .8) * .5 * DT, lookY: 0};
    sim.step(DT, input); rec.capture(); s.events.length = 0;
    p.hp = s.maxHp || 100; s.inventory.ammo[1] = 36; if (s.dead) s.dead = false;
    for (const e of s.enemies) if (e.hp > 0) e.hp = Math.max(e.hp, e.maxHp || e.hp);
  }
  summarize('(b)', rec); const out = rec.result('b', 'Fusil à pompe + 6 ennemis qui tirent (monde plat, « Fracture »)'); out.alive = s.enemies.filter(e => e.hp > 0).length; return out;
}
// ---------- (c) roquettes, explosions et casses (monde classique 2, « Veille des cendres ») ----------
function sceneC() {
  const world = FWorld.create(96, 2);
  const sim = FSimulation.create(world, {armorSystem: true, brain: brain(), inventory: {weapons: [true, true, true], ammo: [180, 36, 12]}});
  const s = sim.state, rec = recorder(sim, world, Math.min(2, world.stage || 0)), input = {moveX: 0, moveY: 1, sprint: false, fire: true, lookX: 0, lookY: 0, weapon: 2};
  for (let i = 0; i < 30 * HZ; i++) {
    const t = i * DT;
    input.moveY = (t % 6) < 3 ? .6 : -.2; input.moveX = Math.sin(t * .5) * .5; input.fire = true; input.weapon = 2; input.lookX = .45 * DT; input.lookY = 0;
    sim.step(DT, input); rec.capture(); s.events.length = 0;
    s.player.hp = s.maxHp || 100; s.inventory.ammo[2] = 12; if (s.dead) s.dead = false;
  }
  summarize('(c)', rec); return rec.result('c', 'Roquettes, explosions et casses (monde classique 2, « Veille des cendres »)');
}
// ---------- (d) combat de boss, campagne v2 monde 1, pilote « skilled » de bench/boss/fight.mjs ----------
function sceneD(index = 0, seed = 96) {
  let profile = FEconomy.fresh({campaignVersion: 2}); const weapons = [false, false, false, false, true];
  for (let i = 0; i < index; i++) { profile = FEconomy.grantBossReward(profile, i); const r = FEconomy.bossReward(i); if (r.weapon !== null) weapons[r.weapon] = true; }
  // pour entendre toutes les armes dans le combat, l'arsenal est complet (c'est un banc de mixage, pas d'équilibrage)
  weapons[0] = weapons[1] = weapons[2] = true;
  const caps = FEconomy.ammoCaps(profile, {campaign: true}), ammo = caps.map((c, i) => weapons[i] ? (i === 4 ? 1 : c) : 0);
  const world = FWorld.create(seed, index, {campaign: true, campaignVersion: 2});
  const sim = FSimulation.create(world, {brain: brain(), inventory: {weapons, ammo, shield: true}, economy: profile,
    campaign: {version: 2, discovered: ['pistol', 'shield', 'smg', 'shotgun', 'rocket'], claimedBossRewards: Array.from({length: index}, (_, i) => i)}});
  const s = sim.state, p = s.player, A = world.bossArena, boss = s.enemies.find(e => e.type === 3 && e.bossScale > 1);
  Object.assign(p, {x: A.x - 24, y: A.y, z: A.z + .3, yaw: Math.PI / 2, pitch: 0}); sim.step(0, {}); s.events.length = 0;
  const rec = recorder(sim, world, Math.max(0, Math.min(2, Math.floor(world.stage || 0))));
  const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
  const corePoint = e => ({x: e.x + Math.sin(e.yaw) * .9 * e.bossScale, y: e.baseY + 1.93 * e.bossScale, z: e.z - Math.cos(e.yaw) * .9 * e.bossScale});
  const aimAt = (x, y, z) => { const dx = x - p.x, dz = z - p.z; p.yaw = Math.atan2(dx, -dz); p.pitch = Math.atan2(y - p.y - 1.62, Math.hypot(dx, dz)); };
  let strafe = 1, firstRoar = null; const marks = [], allNames = {};
  for (let i = 0; i < 75 * HZ && boss.hp > 0; i++) {
    const t = i * DT, input = {moveX: 0, moveY: 0, sprint: true, fire: true, fireLeft: false, dash: false};
    const open = boss.weakPointOpen, target = open ? corePoint(boss) : {x: boss.x, y: boss.baseY + 2.0 * boss.bossScale, z: boss.z};
    const d = dist2(p.x, p.z, boss.x, boss.z), fromCentre = dist2(p.x, p.z, A.x, A.z);
    const guard = s.enemies.filter(e => e.bossWave && e.bossReleased && e.hp > 0 && e.deployed !== false && dist2(e.x, e.z, p.x, p.z) < 24).sort((a, b) => dist2(a.x, a.z, p.x, p.z) - dist2(b.x, b.z, p.x, p.z))[0];
    if (guard && !open) aimAt(guard.x, guard.y, guard.z); else aimAt(target.x, target.y, target.z);
    const am = s.inventory.ammo; let w = open ? (d < 18 && am[1] > 0 ? 1 : am[2] > 0 ? 2 : 0) : 0;
    // alterne les armes pour que la scène contienne SMG, pompe et roquettes
    if (!open) w = [0, 0, 1, 0, 2, 0][Math.floor(t / 2.5) % 6];
    if (s.weapon !== w && weapons[w]) sim.selectWeapon(w); input.weapon = w;
    const rx = p.x - boss.x, rz = p.z - boss.z, rn = Math.max(.01, Math.hypot(rx, rz)), radial = (15 - rn) / 4;
    let mx = -rz / rn * strafe + rx / rn * radial, mz = rx / rn * strafe + rz / rn * radial;
    if (fromCentre > 24) { mx += (A.x - p.x) / fromCentre * 1.5; mz += (A.z - p.z) / fromCentre * 1.5; }
    if (i % 300 === 0) strafe = -strafe;
    const n = Math.hypot(mx, mz); if (n > 1) { mx /= n; mz /= n; }
    const cy = Math.cos(p.yaw), sy = Math.sin(p.yaw); input.moveX = mx * cy + mz * sy; input.moveY = mx * sy - mz * cy;
    if (s.equipment?.left === 'shield') input.fireLeft = s.projectiles.some(q => q.owner === boss.id && Math.hypot(q.x - p.x, q.y - p.y - 1, q.z - p.z) < 9);
    sim.step(DT, input);
    for (const e of s.events) { allNames[e.name] = (allNames[e.name] || 0) + 1; if (e.name === 'bossRoar' && firstRoar === null) firstRoar = i; if (/^boss/.test(e.name)) marks.push([i, e.name + (e.kind ? ':' + e.kind : '')]); }
    rec.capture(); s.events.length = 0;
    p.hp = s.maxHp || 100; for (let k = 0; k < 3; k++) am[k] = caps[k]; if (s.dead) s.dead = false;
  }
  console.log('(d) tous les événements', JSON.stringify(allNames));
  const from = Math.max(0, (firstRoar ?? 0) - 45), to = Math.min(rec.frames.length, from + 30 * HZ);
  summarize('(d) fenêtre ' + from + '..' + to + ' stage ' + world.stage, rec, from, to);
  const out = rec.result('d', 'Combat de boss avec annonces (campagne v2, monde ' + (index + 1) + ', graine ' + seed + ')', from, to);
  out.marks = marks.filter(([i]) => i >= from && i < to).map(([i, n]) => [i - from, n]); out.bossKind = boss.bossKind; return out;
}
const t0 = performance.now();
const scenes = {a: sceneA(), b: sceneB(), c: sceneC(), d: sceneD(+(process.env.BOSS_INDEX || 0))};
for (const k in scenes) console.log(k, scenes[k].label, 'stage', scenes[k].stage, 'frames', scenes[k].frames.length, k === 'd' ? JSON.stringify(scenes[k].marks) : '');
writeFileSync(outDir + '/scenes.js', 'window.SCENES=' + JSON.stringify(scenes) + ';\n');
console.log('scenes.js écrit,', (performance.now() - t0).toFixed(0), 'ms');

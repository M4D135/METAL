// Répartition des attaques choisies (script + réseau tactique) selon la distance du joueur.
// usage : node mix.mjs <ferro> [seconds=120] [brain=1]
import {load, loadout} from './lib.mjs';
const [root, secArg = '120', brainArg = '1'] = process.argv.slice(2);
const W = load(root), dt = 1 / 60, out = [];
for (const index of [0, 1, 2]) for (const dist of [6, 10, 15, 20, 25]) for (const moving of [false, true]) {
  const world = W.FWorld.create(96, index, {campaign: true, campaignVersion: 2});
  const sim = W.FSimulation.create(world, {...(brainArg === '1' ? {brain: W.FBrain.create({mode: 'cpu'})} : {}), ...loadout(W, index)});
  const s = sim.state, p = s.player, A = world.bossArena, boss = s.enemies.find(e => e.type === 3 && e.bossScale > 1);
  Object.assign(p, {x: A.x - dist, y: A.y, z: A.z, yaw: Math.PI / 2}); sim.step(0, {}); s.events.length = 0;
  const count = {}; let open = 0, cycles = 0, lastTell = null; const gaps = [];
  for (let i = 0; i < +secArg / dt; i++) {
    // Mobile : strafe latéral lent autour de la position (vitesse observée non nulle), sinon immobile.
    const input = moving ? {moveX: Math.sin(i / 50), moveY: 0} : {};
    const keep = {x: p.x, z: p.z}; sim.step(dt, input); p.hp = s.maxHp;
    if (!moving) { p.x = keep.x; p.z = keep.z; }
    else { const d = Math.hypot(p.x - boss.x, p.z - boss.z); p.x = boss.x + (p.x - boss.x) / d * dist; p.z = boss.z + (p.z - boss.z) / d * dist; }
    if (boss.weakPointOpen) open += dt;
    for (const e of s.events) if (e.name === 'bossTell') { count[e.kind] = (count[e.kind] || 0) + 1; cycles++; if (lastTell !== null) gaps.push(i * dt - lastTell); lastTell = i * dt; }
    s.events.length = 0;
  }
  const meanGap = gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length);
  out.push({index, kind: boss.bossKind, dist, moving, count, openShare: +(open / +secArg).toFixed(2), cycleS: +meanGap.toFixed(2)});
}
for (const r of out) console.log(JSON.stringify(r));

// Chronologie exacte des attaques de boss : début du télégraphe, passage « actif », impact réel.
// usage : node timing.mjs <ferro> [index=1] [seconds=40]
import {load, loadout} from './lib.mjs';
const [root, idxArg = '1', secArg = '40'] = process.argv.slice(2);
const W = load(root), index = +idxArg, dt = 1 / 60;
const world = W.FWorld.create(96, index, {campaign: true, campaignVersion: 2});
const sim = W.FSimulation.create(world, {brain: W.FBrain.create({mode: 'cpu'}), ...loadout(W, index)});
const s = sim.state, p = s.player, A = world.bossArena, boss = s.enemies.find(e => e.type === 3 && e.bossScale > 1);
// Joueur immobile à 15 m du colosse, regard sur le cœur ; PV maintenus (on ne mesure que la chronologie).
Object.assign(p, {x: A.x - 15, y: A.y, z: A.z + .3, yaw: Math.PI / 2, pitch: 0}); sim.step(0, {}); s.events.length = 0;
const seen = new Map(), rows = [];
for (let i = 0; i < +secArg / dt; i++) {
  const t = i * dt; sim.step(dt, {}); p.hp = s.maxHp;
  for (const a of s.bossAttacks) {
    if (!seen.has(a.id)) seen.set(a.id, {id: a.id, kind: a.kind, phase: a.phase, tell: +a.tell.toFixed(2), start: +(t - a.age + dt).toFixed(2), dist: +Math.hypot(a.x - p.x, a.z - p.z).toFixed(1), radius: a.radius});
    const r = seen.get(a.id);
    if (a.active && r.activeAt === undefined) r.activeAt = +t.toFixed(2);
    if (a.kind === 'ring' && a.active && r.frontAtPlayer === undefined && a.currentRadius >= Math.hypot(p.x - a.x, p.z - a.z) - .28) r.frontAtPlayer = +t.toFixed(2);
    if (a.kind === 'sweep' && a.active && r.sweepEnd === undefined) r.sweepEnd = +(t + a.duration - a.age).toFixed(2);
  }
  for (const e of s.events) if (e.name === 'explosion' && e.owner === boss.id) {
    // Rattache l'explosion à la zone la plus proche déjà active.
    let best = null, bd = 1e9; for (const r of seen.values()) if ((r.kind === 'rocketZone' || r.kind === 'slam') && r.activeAt !== undefined && r.impactAt === undefined) { const a = {x: 0}; }
    for (const [id, r] of seen) if ((r.kind === 'rocketZone' || r.kind === 'slam') && r.activeAt !== undefined && r.impactAt === undefined) { const q = s.bossAttacks.find(a => a.id === id); const d = q ? Math.hypot(q.x - e.x, q.z - e.z) : 1e9; if (d < bd) { bd = d; best = r; } }
    if (best) { best.impactAt = +t.toFixed(2); best.impactOffset = +bd.toFixed(2); best.impactKind = e.kind; }
  }
  s.events.length = 0;
}
for (const r of seen.values()) rows.push({...r, activeDelay: r.activeAt !== undefined ? +(r.activeAt - r.start).toFixed(2) : null, impactAfterActive: r.impactAt !== undefined ? +(r.impactAt - r.activeAt).toFixed(2) : null, totalWarning: r.impactAt !== undefined ? +(r.impactAt - r.start).toFixed(2) : r.frontAtPlayer !== undefined ? +(r.frontAtPlayer - r.start).toFixed(2) : null});
console.log(JSON.stringify({index, kind: boss.bossKind, scale: boss.bossScale, rows}, null, 0).replace(/\},\{/g, '},\n{'));

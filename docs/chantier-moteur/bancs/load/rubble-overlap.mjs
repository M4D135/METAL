// One real rocket per wall (several walls, separate sims): is the next checkpoint restorable? Which rubble/box pair is refused?
// usage: [SRC=dir] node rubble-overlap.mjs <ferroRoot> [spec=l:0] [walls=10] [settleSteps=300]
import {load} from './lib.mjs';
const [root, spec = 'l:0', wallsArg = '10', settleArg = '300'] = process.argv.slice(2);
const W = load(root);
const [kind, idx] = spec.split(':');
const world = kind === 'c' ? W.FWorld.create(96, +idx, {campaign: true, campaignVersion: 2}) : W.FWorld.create(96, +idx);
const inventory = kind === 'c' ? {weapons: [true, true, true, true, true], ammo: [180, 36, 12, 16, 1], shield: false} : {weapons: [true, true, true, true], ammo: [180, 36, 12, 16], shield: false};
const mk = () => { const o = {brain: W.FBrain.create({mode: 'cpu'}), armorSystem: true, inventory}; if (kind === 'c') { o.campaign = {version: 2, discovered: ['pistol', 'smg', 'shotgun', 'grenade', 'rocket'], claimedBossRewards: []}; o.equipment = {right: 2, left: null, shieldEnergy: 100}; } return W.FSimulation.create(world, o); };
const probe = mk(); const walls = [];
for (const g of world.destructibles.filter(g => g.kind === 'wall' && g.colliders.length)) {
  const b = g.bounds, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2, thinX = b.maxX - b.minX < b.maxZ - b.minZ;
  for (const sign of [-1, 1]) { const nx = thinX ? sign : 0, nz = thinX ? 0 : sign, x = cx + nx * 7, z = cz + nz * 7, y = probe.ground(x, z);
    if (!Number.isFinite(y) || Math.abs(y - b.minY) > .1 || probe.blocked(x, z, .28)) continue; const hit = probe.ray([x, y + 1.62, z], [-nx, 0, -nz], 9); if (hit < 6 || hit > 7.4) continue; walls.push({id: g.id, x, y, z, yaw: Math.atan2(-nx, nz), cx, cz}); break; }
}
let refused = 0, tested = 0; const reasons = [];
for (const wall of walls.slice(0, +wallsArg)) {
  const sim = mk(), s = sim.state, p = s.player;
  Object.assign(p, {x: wall.x, z: wall.z, y: wall.y, yaw: wall.yaw, pitch: 0});
  for (let i = 0; i < +settleArg; i++) { sim.step(1 / 60, i === 0 ? {weapon: 2, fire: true} : {}); s.events.length = 0; }
  if (s.dead || !s.debris.some(q => q.structural)) continue;
  tested++; W.__s.rubbleFail = [];
  const ok = mk().restore(JSON.parse(JSON.stringify(sim.snapshot())), {recover: true});
  if (!ok) { refused++; const f = W.__s.rubbleFail[0]; reasons.push(f ? {wall: wall.id, rubble: f.sourceId, shape: f.shape, penetration: f.pen.map(v => +v.toFixed(4)), resting: s.debris.filter(q => q.resting).length, boxIsDestructible: !!f.box.destructibleId, sameSource: f.box.destructibleId === f.sourceId} : {wall: wall.id, other: true}); }
}
console.log(JSON.stringify({spec, wallsTested: tested, refused, reasons}, null, 0).replace(/\},\{/g, '},\n{'));

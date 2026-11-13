// CPU profile of (a) the explosion step of a rocket into a wall, (b) the next 47 steps (nav refresh), (c) renderer.updateWorld.
// usage: node blast-profile.mjs <ferroRoot> [spec=l:0] [wallIndex=0] [phase=explode|pump|render]
import {load, profiler, summarize, stubCanvas} from './lib.mjs';
const [root, spec = 'l:0', wallArg = '0', phase = 'explode'] = process.argv.slice(2);
const W = load(root);
const [kind, idx] = spec.split(':');
const world = kind === 'c' ? W.FWorld.create(96, +idx, {campaign: true, campaignVersion: 2}) : W.FWorld.create(96, +idx);
const inventory = {weapons: [true, true, true, true], ammo: [180, 36, 12, 16], shield: false};
const mk = () => W.FSimulation.create(world, {brain: W.FBrain.create({mode: 'cpu'}), armorSystem: true, inventory});
const probe = mk(); const walls = [];
for (const g of world.destructibles.filter(g => g.kind === 'wall' && g.colliders.length)) {
  const b = g.bounds, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2, thinX = b.maxX - b.minX < b.maxZ - b.minZ;
  for (const sign of [-1, 1]) {
    const nx = thinX ? sign : 0, nz = thinX ? 0 : sign, x = cx + nx * 7, z = cz + nz * 7, y = probe.ground(x, z);
    if (!Number.isFinite(y) || Math.abs(y - b.minY) > .1 || probe.blocked(x, z, .28)) continue;
    const hit = probe.ray([x, y + 1.62, z], [-nx, 0, -nz], 9); if (hit < 6 || hit > 7.4) continue;
    walls.push({x, y, z, yaw: Math.atan2(-nx, nz)}); break;
  }
}
const wall = walls[+wallArg];
const sim = mk(), s = sim.state, p = s.player;
for (let i = 0; i < 30; i++) sim.step(1 / 60, {});
Object.assign(p, {x: wall.x, z: wall.z, y: wall.y, yaw: wall.yaw, pitch: 0});
const prof = await profiler();
const {canvas} = stubCanvas(); const r = W.FRender.create(canvas); r.setWorld(sim.destruction.meshes, sim.destruction.lights, world.environment);
let fired = false;
for (let i = 0; i < 400; i++) {
  // profile only the step that contains the explosion (detected by rocket age), or the following pump steps
  const willExplode = s.projectiles.some(q => q.kind === 'rocket' && q.owner === 'player');
  if (phase === 'explode' && willExplode) {
    const rev = s.destructionRevision; await prof.start(); sim.step(1 / 60, {}); const pr = await prof.stop();
    if (s.destructionRevision !== rev) { const sum = summarize(pr, 30); console.log('explosion step sampled', sum.totalMs, 'ms'); for (const x of sum.inclusive) console.log(x.join('  ')); console.log('SELF'); for (const x of sum.self.slice(0, 15)) console.log(x.join('  ')); break; }
    continue;
  }
  const rev = s.destructionRevision;
  sim.step(1 / 60, i === 0 ? {weapon: 2, fire: true} : {}); fired = true;
  if (s.destructionRevision !== rev && phase === 'pump') {
    await prof.start(); for (let k = 0; k < 47; k++) sim.step(1 / 60, {}); const pr = await prof.stop();
    const sum = summarize(pr, 24); console.log('47 steps after revision, sampled', sum.totalMs, 'ms'); for (const x of sum.inclusive) console.log(x.join('  ')); console.log('SELF'); for (const x of sum.self.slice(0, 12)) console.log(x.join('  ')); break;
  }
  if (s.destructionRevision !== rev && phase === 'render') {
    await prof.start(); for (let k = 0; k < 20; k++) r.updateWorld(sim.destruction.meshes, s.destructionRevision + k, sim.destruction.lights); const pr = await prof.stop();
    const sum = summarize(pr, 16); console.log('20x renderer.updateWorld, sampled', sum.totalMs, 'ms'); for (const x of sum.inclusive) console.log(x.join('  ')); break;
  }
}

// Rocket into a real wall of a generated world, then the cascade over the next steps.
// Control run: same shot with destruction.blast neutralised (same explosion, alert and damage to actors).
// usage: node blast.mjs <ferroRoot> [spec=l:0] [walls=4] [after=300] [srcDir=<ferroRoot>/src]
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {now, stubCanvas} from './lib.mjs';
const [root, spec = 'l:0', wallsArg = '4', afterArg = '300', srcDir = root + '/src'] = process.argv.slice(2);
function loadFrom(dir) {
  const ctx = {window: {}, performance, console, Math, Date}; vm.createContext(ctx);
  for (const n of ['renderer', 'world', 'destruction', 'economy', 'brain', 'simulation'])
    vm.runInContext(readFileSync(dir + '/' + n + '.js', 'utf8'), ctx, {filename: n + '.js'});
  return ctx.window;
}
const W = loadFrom(srcDir);
const [kind, idx] = spec.split(':');
const world = kind === 'c' ? W.FWorld.create(96, +idx, {campaign: true, campaignVersion: 2}) : W.FWorld.create(96, +idx);
const inventory = kind === 'c' ? {weapons: [true, true, true, true, true], ammo: [180, 36, 12, 16, 1], shield: false} : {weapons: [true, true, true, true], ammo: [180, 36, 12, 16], shield: false};
function makeSim() {
  const opts = {brain: W.FBrain.create({mode: 'cpu'}), armorSystem: true, inventory};
  if (kind === 'c') { opts.campaign = {version: 2, discovered: ['pistol', 'smg', 'shotgun', 'grenade', 'rocket'], claimedBossRewards: []}; opts.equipment = {right: 2, left: null, shieldEnergy: 100}; }
  return W.FSimulation.create(world, opts);
}
// Candidate walls: thin tall solid groups with a free standing point 7 m away.
const probe = makeSim();
const walls = [];
for (const g of world.destructibles.filter(g => g.kind === 'wall' && g.colliders.length)) {
  const b = g.bounds, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2, thinX = b.maxX - b.minX < b.maxZ - b.minZ;
  for (const sign of [-1, 1]) {
    const nx = thinX ? sign : 0, nz = thinX ? 0 : sign, x = cx + nx * 7, z = cz + nz * 7, y = probe.ground(x, z);
    if (!Number.isFinite(y) || Math.abs(y - b.minY) > .1 || probe.blocked(x, z, .28)) continue;
    const dir = [-nx, 0, -nz], hit = probe.ray([x, y + 1.62, z], dir, 9);
    if (hit < 6 || hit > 7.4) continue;
    const near = probe.state.enemies.filter(e => e.hp > 0 && e.deployed !== false && Math.hypot(e.x - cx, e.z - cz) < 34).length;
    walls.push({id: g.id, x, y, z, yaw: Math.atan2(dir[0], -dir[2]), cx, cz, near});
    break;
  }
}
walls.sort((a, b) => b.near - a.near);
const chosen = walls.filter((w, i) => walls.findIndex(q => Math.hypot(q.cx - w.cx, q.cz - w.cz) < 30) === i).slice(0, +wallsArg);
const after = +afterArg, results = [];
for (const wall of chosen) {
  const row = {wall: wall.id, enemiesWithin34m: wall.near};
  for (const mode of ['control', 'destroy']) {
    const sim = makeSim(), s = sim.state, p = s.player;
    for (let i = 0; i < 30; i++) sim.step(1 / 60, {});
    Object.assign(p, {x: wall.x, z: wall.z, y: wall.y, yaw: wall.yaw, pitch: 0});
    if (mode === 'control') sim.destruction.blast = () => ({changed: false, revision: sim.destruction.revision, debris: [], events: [], pipeLeaks: [], collapsed: []});
    const {canvas, stub} = stubCanvas(); const r = W.FRender.create(canvas); r.setWorld(sim.destruction.meshes, sim.destruction.lights, world.environment);
    let rev = s.destructionRevision, drawRev = rev;
    const camera = () => ({pos: [p.x, p.y + 1.62, p.z], yaw: p.yaw, pitch: p.pitch, roll: 0, fov: 90});
    for (let i = 0; i < 3; i++) r.draw(camera(), [], {time: s.time});
    const steps = [], frames = []; let exploded = -1, broke = false, revStep = -1;
    for (let i = 0; i < after; i++) {
      const input = i === 0 ? {weapon: 2, fire: true} : {};
      const t0 = now(); sim.step(1 / 60, input); const d = now() - t0;
      if (s.events.some(e => e.name === 'explosion') && exploded < 0) exploded = i;
      if (s.events.some(e => e.name === 'materialBreak')) broke = true;
      if (s.destructionRevision !== rev && revStep < 0) revStep = i;
      steps.push({d, pending: s.aiStats.navPending || 0, searches: s.aiStats.pathSearches || 0, deferred: s.aiStats.pathDeferred || 0, debris: s.debris.length, awake: s.aiStats.awake});
      s.events.length = 0;
      // shell-like frame: syncDestruction + draw (CPU only, stub GL)
      const t1 = now(); let updated = false;
      if (s.destructionRevision !== drawRev) { r.updateWorld(sim.destruction.meshes, s.destructionRevision, sim.destruction.lights); drawRev = s.destructionRevision; updated = true; }
      const t2 = now(); const before = stub.uploaded; r.draw(camera(), [], {time: s.time}); const t3 = now();
      frames.push({update: t2 - t1, draw: t3 - t2, updated, bytes: stub.uploaded - before});
    }
    const sum = (a, f) => a.reduce((n, x) => n + f(x), 0);
    const win = steps.slice(Math.max(0, exploded));
    row[mode] = {explodedAt: exploded, revisionAt: revStep, broke, explosionStepMs: exploded >= 0 ? +steps[exploded].d.toFixed(2) : null,
      nextStepMs: exploded >= 0 ? +steps[exploded + 1].d.toFixed(2) : null,
      maxStepMs: +Math.max(...win.map(x => x.d)).toFixed(2), stepsOver8ms: win.filter(x => x.d > 8).length, stepsOver16ms: win.filter(x => x.d > 16).length,
      totalMsAfter: +sum(win, x => x.d).toFixed(1), pendingSteps: win.filter(x => x.pending > 0).length, maxPending: Math.max(...win.map(x => x.pending)),
      searches: sum(win, x => x.searches), deferred: sum(win, x => x.deferred), maxAwake: Math.max(...win.map(x => x.awake)), debrisAfter: steps.at(-1).debris,
      renderUpdateMs: +sum(frames, f => f.update).toFixed(2), drawAfterUpdateMs: +(frames.filter(f => f.updated).map((f, k, a) => frames[frames.indexOf(f)].draw)[0] ?? 0).toFixed(2),
      medianDrawMs: +frames.map(f => f.draw).sort((a, b) => a - b)[frames.length >> 1].toFixed(2), uploadAfterUpdateBytes: frames.filter(f => f.updated).map(f => frames[frames.indexOf(f)].bytes)[0] ?? 0,
      top5: win.map((x, k) => [k + Math.max(0, exploded), +x.d.toFixed(1), x.pending, x.searches]).sort((a, b) => b[1] - a[1]).slice(0, 5)};
  }
  results.push(row);
}
console.log(JSON.stringify({spec, candidates: walls.length, results}, null, 1));

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const context = { window: {} };
vm.createContext(context);
for (const name of ['renderer', 'world', 'destruction', 'economy', 'simulation']) {
  vm.runInContext(readFileSync(`${root}src/${name}.js`, 'utf8'), context, { filename: `${name}.js` });
}
const { FSimulation, FWorld } = context.window;

function fixture(extra = {}) {
  return {
    seed: 'test', stage: 0, spawn: { x: 0, z: 0, yaw: 0 },
    bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 },
    colliders: [], enemies: [], pickups: [],
    cores: [{ id: 0, x: 15, z: 15 }, { id: 1, x: 18, z: 15 }, { id: 2, x: 21, z: 15 }],
    exit: { x: 24, z: 15 }, ...extra,
  };
}
function advance(sim, seconds, input = {}) {
  for (let remaining = seconds; remaining > 1e-8;) {
    const dt = Math.min(.025, remaining);
    sim.step(dt, input);
    remaining -= dt;
  }
}
function events(sim, name) { return sim.state.events.filter(event => event.name === name); }

function walkTo(sim, target, onStep = () => {}) {
  for (let frame = 0; frame < 1600; frame++) {
    const p = sim.state.player, dx = target.x - p.x, dz = target.z - p.z;
    const distance = Math.hypot(dx, dz);
    if (distance < .09) return;
    assert.equal(sim.state.dead, false, 'Player died during navigation');
    if (sim.state.won) return;
    const gain = Math.min(1, distance / .105);
    sim.step(.025, {
      moveX: (Math.cos(p.yaw) * dx + Math.sin(p.yaw) * dz) / distance * gain,
      moveY: (Math.sin(p.yaw) * dx - Math.cos(p.yaw) * dz) / distance * gain,
    });
    onStep();
  }
  assert.fail(`Unable to walk normally to (${target.x}, ${target.z})`);
}

test('Swept movement stops at a thin wall and slides along it, including a large move', () => {
  const sim = FSimulation.create(fixture({
    colliders: [{ minX: 2, maxX: 2.08, minZ: -20, maxZ: 20, minY: 0, maxY: 4 }],
  }));
  sim.move(sim.state.player, 18, 7);
  assert(sim.state.player.x <= 1.72 + 1e-9, 'Player tunneled through the thin wall');
  assert(Math.abs(sim.state.player.z - 7) < 1e-8, 'Collision prevented valid sliding');
  assert.equal(sim.blocked(sim.state.player.x, sim.state.player.z), false);
  sim.move(sim.state.player, -100, 0);
  assert(sim.state.player.x >= -29.72 - 1e-8, 'Player crossed the world boundary');
});

test('Spatial collision lookup matches exhaustive disc checks at bucket edges, corners and all body sizes', () => {
  // Independent exhaustive reference: this deliberately knows nothing about buckets.
  function exhaustive(world, x, z, radius) {
    const b = world.bounds;
    if (x - radius < b.minX || x + radius > b.maxX || z - radius < b.minZ || z + radius > b.maxZ) return true;
    const surfaces = (world.walkable || []).filter(a => Math.abs(x - a.x) <= a.w / 2 + 1e-7 && Math.abs(z - a.z) <= a.d / 2 + 1e-7);
    if (world.walkable?.length && !surfaces.length) return true;
    const ordinary = surfaces.filter(a => !a.substrate && !a.fallback), chosen = ordinary.length ? ordinary : surfaces, flats = chosen.filter(a => !a.slopeX && !a.slopeZ);
    const y = surfaces.length ? Math.max(...(flats.length ? flats : chosen).map(a => (a.y || 0) + (x - a.x) * (a.slopeX || 0) + (z - a.z) * (a.slopeZ || 0))) : 0;
    const doors = (world.doors || []).filter(d => d.requires !== undefined).map(d => ({ minX: d.x - d.w / 2, maxX: d.x + d.w / 2, minZ: d.z - d.d / 2, maxZ: d.z + d.d / 2, minY: d.y || 0, maxY: (d.y || 0) + d.h }));
    return world.colliders.concat(doors, world.trapBoxes || []).some(q => {
      if (!(q.minY < y + 1.8 - 1e-7 && q.maxY > y + .06)) return false;
      const dx = x - Math.max(q.minX, Math.min(q.maxX, x));
      const dz = z - Math.max(q.minZ, Math.min(q.maxZ, z));
      return dx * dx + dz * dz < radius * radius;
    });
  }
  const radii = [.28, .38, 1.05, 1.6];
  let samples = 0, randomState = 1234567;
  const random = () => ((randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let stage = 0; stage < 3; stage++) {
    const world = FWorld.create(96, stage), sim = FSimulation.create(world), b = world.bounds;
    function check(x, z, radius) {
      assert.equal(sim.blocked(x, z, radius), exhaustive({ ...world, colliders: sim.destruction.colliders, trapBoxes: sim.state.traps.filter(t => t.box && ['blade', 'press'].includes(t.kind)).map(t => t.box) }, x, z, radius), `stage ${stage}, (${x}, ${z}), radius ${radius}`);
      samples++;
    }
    for (let i = 0; i < 2400; i++) check(b.minX - 2 + random() * (b.maxX - b.minX + 4), b.minZ - 2 + random() * (b.maxZ - b.minZ + 4), radii[i % radii.length]);
    for (const q of world.colliders) for (const radius of radii) {
      const x = (q.minX + q.maxX) / 2, z = (q.minZ + q.maxZ) / 2;
      check(q.minX - radius, z, radius); check(q.maxX + radius - 1e-9, z, radius);
      check(q.minX - radius * Math.SQRT1_2, q.minZ - radius * Math.SQRT1_2, radius);
      for (const epsilon of [-1e-9, 0, 1e-9]) check(Math.round(x / 8) * 8 + epsilon, Math.round(z / 8) * 8 - epsilon, radius);
    }
  }
  assert(samples > 20000);
});

test('A very large frame delta cannot teleport the player through a wall', () => {
  const sim = FSimulation.create(fixture({
    spawn: { x: 0, z: -.4, yaw: 0 },
    colliders: [{ minX: -5, maxX: 5, minZ: -1.1, maxZ: -1, minY: 0, maxY: 4 }],
  }));
  sim.step(30, { moveY: 1, sprint: true });
  assert(sim.state.player.z >= -.72 - 1e-8);
  assert(sim.state.elapsed <= .05 + 1e-9);
});

test('Ray and weapon hit the near wall, never an enemy behind it', () => {
  const wall = { minX: -3, maxX: 3, minZ: -5, maxZ: -4.8, minY: 0, maxY: 4 };
  const sim = FSimulation.create(fixture({ colliders: [wall], enemies: [{ x: 0, z: -8, type: 2 }] }));
  assert(Math.abs(sim.ray([0, 1.62, 0], [0, 0, -1], 75) - 4.8) < 1e-9);
  const hp = sim.state.enemies[0].hp;
  assert.equal(sim.fire(), true);
  assert.equal(sim.state.enemies[0].hp, hp);
  assert.equal(sim.state.hits, 0);
  assert.equal(sim.sight(0, 0, 0, -8), false);
});

test('A shot hits the nearest exposed enemy before a wall and registers a kill once', () => {
  const sim = FSimulation.create(fixture({
    colliders: [{ minX: -3, maxX: 3, minZ: -7, maxZ: -6.8, minY: 0, maxY: 4 }],
    enemies: [{ x: 0, z: -3, type: 2 }, { x: 0, z: -9, type: 2 }],
  }));
  const initialHp = sim.state.enemies[0].hp, distantHp = sim.state.enemies[1].hp;
  for (let shot = 0; shot < initialHp; shot++) {
    assert.equal(sim.fire(), true);
    advance(sim, .18);
  }
  assert.equal(sim.state.enemies[0].hp, 0);
  assert.equal(sim.state.enemies[1].hp, distantHp);
  assert.equal(sim.state.kills, 1);
  assert.equal(sim.state.hits, initialHp);
  assert.equal(events(sim, 'kill').length, 1);
  sim.fire();
  assert.equal(sim.state.kills, 1);
});

test('An exposed enemy can be hit above low cover when the actual 3D firing ray is clear', () => {
  const sim = FSimulation.create(fixture({
    colliders: [{ minX: -3, maxX: 3, minZ: -4, maxZ: -3.7, minY: 0, maxY: 1.3 }],
    enemies: [{ x: 0, z: -7, type: 2 }],
  }));
  assert.equal(sim.ray([0, 1.62, 0], [0, 0, -1], 75), 75);
  const hp = sim.state.enemies[0].hp;
  sim.fire();
  assert.equal(sim.state.enemies[0].hp, hp - 1, 'A fixed-height visibility check incorrectly blocks this clear shot');
});

test('Sustained fire overheats; shots remain blocked until the weapon cools', () => {
  const sim = FSimulation.create(fixture());
  for (let frame = 0; frame < 600 && !sim.state.player.overheated; frame++) sim.step(.025, { fire: true });
  assert.equal(sim.state.player.overheated, true);
  assert.equal(events(sim, 'overheat').length, 1);
  const shots = sim.state.shots;
  assert.equal(sim.fire(), false);
  advance(sim, .2, { fire: true });
  assert.equal(sim.state.shots, shots);
  advance(sim, 3);
  assert.equal(sim.state.player.overheated, false);
  assert(events(sim, 'cooled').length > 0);
  assert.equal(sim.fire(), true);
});

test('Dash briefly grants immunity and cannot be retriggered during its cooldown', () => {
  const sim = FSimulation.create(fixture());
  sim.step(.025, { dash: true });
  assert(sim.state.player.dashing > 0);
  sim.hurt(50);
  assert.equal(sim.state.player.hp, 100);
  advance(sim, .3, { dash: true });
  assert.equal(events(sim, 'dash').length, 1);
  assert.equal(sim.state.player.dashing, 0);
  sim.hurt(20);
  assert.equal(sim.state.player.hp, 80);
  advance(sim, .8, { dash: true });
  assert.equal(events(sim, 'dash').length, 1);
  advance(sim, .7, { dash: true });
  assert.equal(events(sim, 'dash').length, 2);
});

test('A lethal projectile ends the frame before a relay can heal a dead player', () => {
  const sim = FSimulation.create(fixture({
    cores: [{ id: 0, x: 0, z: 0 }, { id: 1, x: 10, z: 10 }, { id: 2, x: 15, z: 15 }],
  }));
  sim.state.bullets.push({ x: 0, y: 1.4, z: -.1, dx: 0, dy: 0, dz: 1, life: 1, damage: 200 });
  sim.step(.025);
  assert.equal(sim.state.dead, true);
  assert.equal(sim.state.player.hp, 0, 'Dead player should not receive same-frame pickup healing');
  assert.equal(sim.state.relays, 0);
  assert.equal(events(sim, 'dead').length, 1);
  assert.equal(events(sim, 'core').length, 0);
});

test('Normal movement collects three relays before the exit wins, with no repeated events', () => {
  const world = fixture({
    cores: [{ id: 0, x: 0, z: -3 }, { id: 1, x: 0, z: -7 }, { id: 2, x: 0, z: -11 }],
    exit: { x: 4, z: 0 },
  });
  const sim = FSimulation.create(world);
  walkTo(sim, world.exit);
  assert.equal(sim.state.won, false, 'Exit opened without the relays');
  for (const core of world.cores) walkTo(sim, core);
  assert.equal(sim.state.relays, 3);
  assert(sim.state.cores.every(core => core.taken));
  assert.equal(events(sim, 'core').length, 3);
  walkTo(sim, world.exit);
  assert.equal(sim.state.won, true);
  assert.equal(events(sim, 'win').length, 1);
  const position = [sim.state.player.x, sim.state.player.z], elapsed = sim.state.elapsed;
  advance(sim, .5, { moveY: 1, fire: true });
  assert.deepEqual([sim.state.player.x, sim.state.player.z], position);
  assert.equal(sim.state.elapsed, elapsed);
  assert.equal(sim.fire(), false);
  assert.equal(events(sim, 'win').length, 1);
});

function route(sim, target) {
  const { cells, nx, nz, idx, coord } = sim.nav;
  function avoidsPads(a, b) {
    const dx = b[0] - a[0], dz = b[1] - a[1], length = dx * dx + dz * dz;
    return !(sim.state.jumpPads || []).some(p => {
      const t = length ? Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.z - a[1]) * dz) / length)) : 0;
      return Math.hypot(a[0] + dx * t - p.x, a[1] + dz * t - p.z) <= p.r + .025;
    });
  }
  function nearest(point) {
    const center = idx(point.x, point.z), cx = center % nx, cz = Math.floor(center / nx);
    let closest = -1, distance = Infinity;
    for (let oz = -3; oz <= 3; oz++) for (let ox = -3; ox <= 3; ox++) {
      const x = cx + ox, z = cz + oz, index = z * nx + x;
      if (x < 0 || x >= nx || z < 0 || z >= nz || !cells[index]) continue;
      const [px, pz] = coord(index), d = Math.hypot(px - point.x, pz - point.z);
      if (d < distance && sim.nav.canTraverse(point.x, point.z, px, pz)) { closest = index; distance = d; }
    }
    return closest;
  }
  const start = nearest(sim.state.player), end = nearest(target);
  assert(start >= 0, 'Start does not map to navigable ground');
  assert(end >= 0, 'Objective does not map to navigable ground');
  const parent = new Int32Array(cells.length).fill(-1), queue = [start];
  parent[start] = start;
  for (let head = 0; head < queue.length && parent[end] < 0; head++) {
    const at = queue[head], x = at % nx, z = Math.floor(at / nx);
    for (const next of [x ? at - 1 : -1, x < nx - 1 ? at + 1 : -1, z ? at - nx : -1, z < nz - 1 ? at + nx : -1]) {
      if (next >= 0 && cells[next] && parent[next] < 0 && avoidsPads(coord(at), coord(next)) && sim.nav.canTraverse(...coord(at), ...coord(next))) { parent[next] = at; queue.push(next); }
    }
  }
  assert(parent[end] >= 0, 'No navigation route to objective');
  const path = [];
  for (let at = end; at !== start; at = parent[at]) { const [x, z] = coord(at); path.push({ x, z }); }
  path.reverse();
  path.push(target);
  return path;
}

test('A real generated level can be completed using navigation and ordinary collision-respecting movement', () => {
  const world = FWorld.create('FERRO-01', 0);
  // Isolate navigation from combat: all original architecture, obstacles and objectives remain.
  const sim = FSimulation.create({ ...world, enemies: [] });
  let frames = 0;
  const checkPosition = () => {
    frames++;
    const p = sim.state.player;
    assert.equal(sim.blocked(p.x, p.z), false, 'Player entered a wall');
    assert.equal(FWorld.isWalkable(world, p.x, p.z, .26), true, 'Player left the physical floor');
  };
  for (const mechanism of world.mechanisms || []) {
    const access = { x: mechanism.x, z: mechanism.z + .95 };
    for (const point of route(sim, access)) walkTo(sim, point, checkPosition);
    assert.equal(sim.nearestInteraction()?.id, mechanism.id);
    assert.equal(sim.interact(), true);
    advance(sim, 1.2);
  }
  for (const target of [...world.cores, world.exit]) {
    for (const point of route(sim, target)) {
      walkTo(sim, point, checkPosition);
      if (sim.state.won) break;
    }
  }
  assert.equal(sim.state.relays, 3);
  assert.equal(sim.state.won, true);
  assert(frames > 500, 'The run should traverse the level rather than teleport');
  assert.equal(events(sim, 'win').length, 1);
});

test('Fracture rewards close range, preserves shot accuracy accounting and has a slower recovery', () => {
  const close = FSimulation.create(fixture({ enemies: [{ x: 0, z: -3, type: 2 }] }));
  close.step(.025, { weapon: 1 });
  assert.equal(close.fire(), true);
  assert.equal(close.state.enemies[0].hp, 0, 'A centred close shot should land enough pellets');
  assert.equal(close.state.shots, 1);
  assert.equal(close.state.hits, 1, 'Pellets must not inflate accuracy above 100%');
  assert.equal(events(close, 'fracture').length, 1);
  assert(close.state.player.heat > .3);
  advance(close, .4);
  assert.equal(close.fire(), false, 'Shotgun fired before its recovery finished');
  advance(close, .4);
  assert.equal(close.fire(), true);
  const distant = FSimulation.create(fixture({ enemies: [{ x: 0, z: -18, type: 2 }] }));
  distant.step(.025, { weapon: 1 }); distant.fire();
  assert(distant.state.enemies[0].hp > 3, 'Spread and falloff should limit distant shotgun damage');
  const wall = { minX: -6, maxX: 6, minZ: -5, maxZ: -4.8, minY: 0, maxY: 5 };
  const covered = FSimulation.create(fixture({ colliders: [wall], enemies: [{ x: 0, z: -8, type: 2 }] }));
  covered.step(.025, { weapon: 1 }); covered.fire();
  assert.equal(covered.state.enemies[0].hp, 4, 'A spread pellet crossed a solid wall');
});

test('Pulse immediately enters cooldown, clears nearby projectiles, respects walls and pushes safely', () => {
  const sim = FSimulation.create(fixture({
    colliders: [
      { minX: 2, maxX: 2.2, minZ: -2, maxZ: 2, minY: 0, maxY: 4 },
      { minX: -3, maxX: 3, minZ: -6, maxZ: -5.8, minY: 0, maxY: 4 },
    ],
    enemies: [{ x: 0, z: -4, type: 1 }, { x: 4, z: 0, type: 2 }],
  }));
  sim.state.bullets.push(
    { x: 1, y: 1.4, z: -2, dx: 0, dy: 0, dz: 1, life: 3, damage: 8 },
    { x: 12, y: 1.4, z: -2, dx: 0, dy: 0, dz: 1, life: 3, damage: 8 },
  );
  assert.equal(sim.pulse(), true);
  assert.equal(sim.state.player.pulseCooldown, 7);
  assert.equal(sim.pulse(), false);
  assert.equal(sim.state.enemies[0].hp, 3);
  assert(sim.state.enemies[0].z < -4);
  assert.equal(sim.blocked(sim.state.enemies[0].x, sim.state.enemies[0].z, .38), false);
  assert(sim.state.enemies[0].stun > 0);
  assert.equal(sim.state.enemies[1].hp, 4, 'Pulse damage crossed a wall');
  assert.equal(sim.state.bullets.length, 1);
  assert.equal(sim.state.bullets[0].x, 12);
  advance(sim, .25, { pulse: true });
  assert.equal(events(sim, 'pulse').length, 1, 'Held input retriggered pulse during cooldown');
});

test('Turret attacks have a readable windup and a dodgeable locked burst', () => {
  const sim = FSimulation.create(fixture({ enemies: [{ x: 0, z: -10, type: 2 }] }));
  const turret = sim.state.enemies[0]; turret.cooldown = 0;
  sim.step(.025);
  assert.equal(turret.attackState, 'aim');
  assert(turret.windup >= .7);
  advance(sim, .3);
  assert.equal(sim.state.bullets.length, 0, 'Turret fired before the telegraph finished');
  sim.move(sim.state.player, 5, 0);
  advance(sim, 2.1);
  assert.equal(events(sim, 'enemyShot').length, 3);
  assert.equal(sim.state.player.hp, 100, 'Locked shots should be avoidable by leaving the aimed position');
  assert.equal(turret.x, 0, 'Turret should remain a stationary threat');
});

test('Scouts strafe while heavies telegraph a committed charge that can be sidestepped', () => {
  const scoutSim = FSimulation.create(fixture({ enemies: [{ x: 0, z: -6, type: 0 }] }));
  scoutSim.state.enemies[0].cooldown = 10;
  advance(scoutSim, 1);
  assert(Math.abs(scoutSim.state.enemies[0].x) > .35, 'Scout only approached in a straight line');
  const sim = FSimulation.create(fixture({ enemies: [{ x: 0, z: -5, type: 1 }] }));
  const heavy = sim.state.enemies[0]; heavy.cooldown = 0;
  sim.step(.025);
  assert.equal(heavy.attackState, 'aim');
  advance(sim, .45);
  assert.equal(sim.state.player.hp, 100);
  sim.move(sim.state.player, 3, 0);
  let charged = false;
  for (let frame = 0; frame < 40; frame++) { sim.step(.025); charged ||= heavy.attackState === 'rush'; }
  assert(charged, 'Heavy never committed to its signalled charge');
  assert.equal(sim.state.player.hp, 100);
  assert(Math.abs(heavy.x) < .01, 'Charge followed the player after its target was locked');
});

test('A charging heavy cannot deal contact damage through a thin wall', () => {
  const sim = FSimulation.create(fixture({
    spawn: { x: 0, z: -.2, yaw: 0 },
    colliders: [{ minX: -5, maxX: 5, minZ: -.6, maxZ: -.5, minY: 0, maxY: 4 }],
    enemies: [{ x: 0, z: -1.1, type: 1 }],
  }));
  // Reproduce an already committed charge after the player moved behind cover.
  const heavy = sim.state.enemies[0];
  Object.assign(heavy, { active: true, attackState: 'rush', rushTime: .5, rushX: 0, rushZ: 1 });
  advance(sim, .2);
  assert(Math.hypot(heavy.x - sim.state.player.x, heavy.z - sim.state.player.z) < .9,
    'Fixture must place the enemy inside contact range across the wall');
  assert.equal(sim.sight(heavy.x, heavy.z, sim.state.player.x, sim.state.player.z), false);
  assert.equal(sim.state.player.hp, 100, 'A heavy applied contact damage through solid cover');
  assert.equal(heavy.rushHit, false);
});

test('Boss begins at 30 HP, telegraphs fan attacks and changes phase once at half health', () => {
  const sim = FSimulation.create(fixture({ stage: 2, enemies: [{ x: 0, z: -12, type: 3, boss: true }] }));
  const boss = sim.state.enemies[0];
  assert.equal(boss.hp, 30); assert.equal(sim.state.bossAlive, true);
  boss.cooldown = 0; sim.step(.025);
  advance(sim, .9);
  assert.equal(sim.state.bullets.length, 0);
  advance(sim, .3);
  assert.equal(events(sim, 'enemyShot').length, 5);
  const angles = sim.state.bullets.map(q => Math.atan2(q.dx, -q.dz));
  assert(Math.max(...angles) - Math.min(...angles) > .5, 'Boss volley did not spread into a dodgeable fan');
  boss.hp = 15; sim.step(.025);
  assert.equal(boss.phase, 1);
  assert.equal(events(sim, 'bossPhase').length, 1);
  advance(sim, 1.8);
  assert.equal(events(sim, 'bossPhase').length, 1);
  assert.equal(events(sim, 'enemyShot').length, 12, 'Second phase should send a seven-projectile fan');
});

test('All relays still leave the exit locked until the boss has been destroyed', () => {
  const world = fixture({
    stage: 2, cores: [0, 1, 2].map(id => ({ id, x: 0, z: 0 })), exit: { x: 0, z: 0 },
    enemies: [{ x: 0, z: -8, type: 3, boss: true }],
  });
  const sim = FSimulation.create(world);
  sim.step(.025);
  assert.equal(sim.state.relays, 3);
  assert.equal(sim.state.won, false);
  sim.state.enemies[0].hp = 1;
  sim.fire(); sim.step(.025);
  assert.equal(sim.state.bossAlive, false);
  assert.equal(sim.state.won, true);
  assert.equal(events(sim, 'win').length, 1);
});

test('Kill chains increase score once and expire without erasing earned points', () => {
  const sim = FSimulation.create(fixture({ enemies: [{ x: -1, z: -2, type: 0 }, { x: 1, z: -2, type: 0 }] }));
  sim.pulse();
  assert.equal(sim.state.kills, 2);
  assert.equal(sim.state.combo, 2);
  assert.equal(sim.state.score, 225);
  assert.equal(events(sim, 'combo').length, 1);
  const earned = sim.state.score;
  advance(sim, 4.1);
  assert.equal(sim.state.combo, 0);
  assert.equal(sim.state.score, earned);
  assert.equal(sim.state.kills, 2);
});

test('Vent phases warn before activation and apply timed damage instead of damage every frame', () => {
  const sim = FSimulation.create(fixture({ hazards: [{ x: 0, z: 0, r: 1, period: 3, active: 1.5, phase: 0, type: 'vent' }] }));
  advance(sim, .2);
  assert.equal(sim.state.hazards[0].hot, true);
  assert.equal(sim.state.player.hp, 92);
  advance(sim, .4);
  assert.equal(sim.state.player.hp, 92);
  advance(sim, .1);
  assert.equal(sim.state.player.hp, 84);
  advance(sim, 1.65);
  assert.equal(sim.state.hazards[0].hot, false);
  assert.equal(sim.state.hazards[0].warning, true);
  assert.equal(sim.state.player.hp, 76);
  advance(sim, .3);
  assert.equal(sim.state.player.hp, 76, 'A warning phase caused damage');
});

test('Checkpoint round-trip preserves combat, weapon, cooldowns and object references', () => {
  const world = fixture({ enemies: [{ x: 0, z: -10, type: 2 }, { x: 6, z: -10, type: 0 }] });
  const original = FSimulation.create(world);
  original.step(.025, { weapon: 1, pulse: true, moveX: 1 }); original.fire();
  advance(original, 2.2);
  assert(original.state.bullets.length > 0, 'Checkpoint fixture must include live combat projectiles');
  const data = JSON.parse(JSON.stringify(original.snapshot())), restored = FSimulation.create(world);
  const stateRef = restored.state, playerRef = restored.state.player;
  assert.equal(restored.restore(data), true);
  assert.equal(restored.state, stateRef);
  assert.equal(restored.state.player, playerRef);
  assert.equal(JSON.stringify(restored.snapshot()), JSON.stringify(original.snapshot()));
  assert.equal(restored.state.events.length, 0, 'Past sound/score events should not replay after loading');
  for (let frame = 0; frame < 30; frame++) {
    const input = { moveX: .25, lookX: .002 };
    original.step(.025, input); restored.step(.025, input);
  }
  assert.equal(JSON.stringify(restored.snapshot()), JSON.stringify(original.snapshot()), 'Restored combat diverged from the same inputs');
});

test('Malformed or incompatible checkpoints are rejected atomically', () => {
  const world = fixture({
    enemies: [{ x: 0, z: -10, type: 2 }],
    colliders: [{ minX: 2, maxX: 3, minZ: -3, maxZ: 3, minY: 0, maxY: 4 }],
  });
  const sim = FSimulation.create(world), good = sim.snapshot();
  const mutations = [
    d => { d.version = 999; }, d => { d.fingerprint = 'wrong'; },
    d => { d.state.player.x = Infinity; }, d => { d.state.player.x = 2.5; },
    d => { d.state.player.hp = -1; }, d => { d.state.weapon = 7; },
    d => { d.state.enemies[0].hp = 50; }, d => { d.state.enemies.pop(); },
    d => { d.state.relays = 3; }, d => { d.timers.fireWait = -1; },
    d => { d.state.hits = 10; }, d => { d.state.bossAlive = true; },
    d => { d.state.bullets = [{ x: 0, y: 1, z: 0, dx: 0, dy: 0, dz: 1, life: 1, damage: NaN }]; },
  ];
  const before = JSON.stringify(sim.snapshot());
  for (const mutate of mutations) {
    const damaged = JSON.parse(JSON.stringify(good)); mutate(damaged);
    assert.equal(sim.restore(damaged), false);
    assert.equal(JSON.stringify(sim.snapshot()), before, 'Rejected checkpoint partially changed the live game');
  }
  for (const invalid of [null, undefined, {}, { state: {} }]) assert.equal(sim.restore(invalid), false);
  const otherWorld = FSimulation.create({ ...world, exit: { x: 20, z: 20 } });
  assert.equal(otherWorld.restore(good), false, 'Checkpoint from changed geometry/objectives was accepted');
});

test('Fresh generated checkpoints round-trip for all three stages, including the boss world', () => {
  for (let stage = 0; stage < 3; stage++) {
    const world = FWorld.create('FERRO-02', stage), first = FSimulation.create(world), second = FSimulation.create(world);
    assert.equal(second.restore(JSON.parse(JSON.stringify(first.snapshot()))), true, `Stage ${stage} checkpoint failed`);
    assert.equal(JSON.stringify(second.snapshot()), JSON.stringify(first.snapshot()));
  }
});

test('Recovery mode clears immediate projectile danger and grants only temporary unsaved protection', () => {
  const world = fixture(), original = FSimulation.create(world);
  original.hurt(92);
  original.state.bullets.push(
    { x: 0, y: 1.4, z: -.1, dx: 0, dy: 0, dz: 1, life: 3, damage: 20 },
    { x: 4, y: 1.4, z: 0, dx: -.1, dy: 0, dz: 0, life: 3, damage: 20 },
  );
  const data = original.snapshot(), exact = FSimulation.create(world), recovered = FSimulation.create(world);
  assert.equal(exact.restore(data), true); exact.step(.025);
  assert.equal(exact.state.dead, true, 'The fixture must reproduce immediate death after an exact restore');
  assert.equal(recovered.restore(data, { recover: true }), true);
  assert.equal(recovered.state.bullets.length, 1);
  assert.equal(recovered.state.bullets[0].x, 4, 'Recovery should not clear distant attacks');
  recovered.hurt(100);
  assert.equal(recovered.state.player.hp, 8);
  advance(recovered, 1.2); recovered.snapshot(); recovered.hurt(100);
  assert.equal(recovered.state.dead, false, 'Reading a snapshot cancelled an active recovery window');
  advance(recovered, .25); recovered.hurt(8);
  assert.equal(recovered.state.dead, true, 'Recovery immunity never expired');

  assert.equal(recovered.restore(data, { recover: true }), true);
  const transient = recovered.snapshot();
  assert.equal(exact.restore(transient), true); exact.hurt(8);
  assert.equal(exact.state.dead, true, 'Temporary recovery protection leaked into the saved state');
  assert.equal(recovered.restore(data), true); recovered.hurt(8);
  assert.equal(recovered.state.dead, true, 'Exact restore retained a previous recovery window');

  const terminal = FSimulation.create(world); terminal.hurt(100);
  assert.equal(exact.restore(terminal.snapshot(), { recover: true }), true);
  assert.equal(exact.state.player.hp, 0);
  assert.equal(exact.state.dead, true, 'Recovery resurrected a checkpoint whose player was already dead');
});

function advanceAt(sim, seconds, fps, input = {}) {
  for (let remaining = seconds; remaining > 1e-9;) {
    const dt = Math.min(1 / fps, remaining);
    sim.step(dt, input); remaining -= dt;
  }
}

test('Analogue movement retains stick magnitude and diagonals cannot exceed cardinal speed', () => {
  const straight = FSimulation.create(fixture()), diagonal = FSimulation.create(fixture());
  const half = FSimulation.create(fixture()), quarter = FSimulation.create(fixture());
  advanceAt(straight, 2, 60, { moveY: 1 });
  advanceAt(diagonal, 2, 60, { moveX: 1, moveY: 1 });
  advanceAt(half, 2, 60, { moveX: .3, moveY: .4 });
  advanceAt(quarter, 2, 60, { moveY: .25 });
  assert(Math.abs(straight.state.locomotion.speed - 4.2) < .001);
  assert(Math.abs(diagonal.state.locomotion.speed - straight.state.locomotion.speed) < .001);
  assert(Math.abs(diagonal.state.locomotion.distance - straight.state.locomotion.distance) < .001);
  assert(Math.abs(half.state.locomotion.distance / straight.state.locomotion.distance - .5) < .001);
  assert(Math.abs(quarter.state.locomotion.speed / straight.state.locomotion.speed - .25) < .001);
  assert(Math.abs(half.state.locomotion.vx / -half.state.locomotion.vz - .75) < .001);
  assert.equal(straight.state.moving, straight.state.locomotion.speed);
  assert(Math.abs(straight.state.locomotion.distance + straight.state.player.z) < 1e-8);
});

test('Walk, run, reversal and braking give the same travelled route at 20–120 simulation steps per second', () => {
  const results = [];
  for (const fps of [20, 30, 60, 120]) {
    const sim = FSimulation.create(fixture());
    for (const [duration, input] of [
      [.8, { moveY: 1 }], [.4, { moveY: 1, sprint: true }],
      [.35, { moveY: -1 }], [.4, { moveX: 1, moveY: 1 }], [.45, {}],
    ]) advanceAt(sim, duration, fps, input);
    results.push({ x: sim.state.player.x, z: sim.state.player.z, distance: sim.state.locomotion.distance });
    assert.equal(sim.state.locomotion.speed, 0);
  }
  for (const result of results.slice(1)) {
    assert(Math.hypot(result.x - results[0].x, result.z - results[0].z) < .003,
      'Frame rate changed the route by more than three millimetres');
    // Arc length is measured from physical substep segments, not a predicted speed integral.
    assert(Math.abs(result.distance - results[0].distance) < .025,
      'Frame rate changed travelled path length by more than 2.5 centimetres');
  }
});

test('Acceleration is soft while release and reversal are responsive without mouse aim lag', () => {
  const sim = FSimulation.create(fixture());
  sim.step(1 / 60, { moveY: 1 });
  assert(sim.state.locomotion.forward > 0 && sim.state.locomotion.forward < 2,
    'Walking jumped instantly to full speed');
  advanceAt(sim, .5, 120, { moveY: 1 });
  assert(sim.state.locomotion.forward > 4.1);
  const stoppedFrom = sim.state.player.z;
  advanceAt(sim, .25, 120);
  assert.equal(sim.state.locomotion.speed, 0);
  assert(stoppedFrom - sim.state.player.z < .16, 'Release left excessive skating distance');
  const stoppedAt = sim.state.player.z, stride = sim.state.locomotion.stridePhase;
  advanceAt(sim, .5, 60);
  assert.equal(sim.state.player.z, stoppedAt);
  assert.equal(sim.state.locomotion.stridePhase, stride, 'Stride continued while stationary');
  advanceAt(sim, .5, 120, { moveY: 1 });
  advanceAt(sim, .08, 120, { moveY: -1 });
  assert(sim.state.locomotion.forward < -2, 'Counter-direction braking feels sluggish');
  const yaw = sim.state.player.yaw;
  sim.step(1 / 120, { lookX: .7, lookY: .2, moveY: 1 });
  assert.equal(sim.state.player.yaw, yaw + .7, 'Movement smoothing delayed mouse yaw');
  assert.equal(sim.state.player.pitch, .2, 'Movement smoothing delayed mouse pitch');
});

test('Sprint presentation follows a smooth physical transition instead of the sprint key alone', () => {
  const sim = FSimulation.create(fixture());
  advanceAt(sim, .5, 60, { moveY: 1 });
  assert(sim.state.locomotion.sprintBlend < .001);
  sim.step(1 / 60, { moveY: 1, sprint: true });
  assert(sim.state.locomotion.speed > 4.2 && sim.state.locomotion.speed < 5.8);
  assert(sim.state.locomotion.sprintBlend > 0 && sim.state.locomotion.sprintBlend < .5);
  advanceAt(sim, .4, 60, { moveY: 1, sprint: true });
  assert(sim.state.locomotion.speed > 5.7 && sim.state.locomotion.speed <= 5.8 + 1e-8);
  assert(sim.state.locomotion.sprintBlend > .95);
  sim.step(1 / 60, { moveY: 1 });
  assert(sim.state.locomotion.speed > 4.2 && sim.state.locomotion.speed < 5.8);
  advanceAt(sim, .4, 60, { moveY: 1 });
  assert(sim.state.locomotion.sprintBlend < .001);
});

test('Pushing a wall produces no fake velocity, stride, sprint or dash animation while sliding remains possible', () => {
  const sim = FSimulation.create(fixture({
    colliders: [{ minX: .8, maxX: .9, minZ: -20, maxZ: 20, minY: 0, maxY: 4 }],
  }));
  advanceAt(sim, 1, 60, { moveX: 1, sprint: true });
  assert(sim.state.player.x <= .52 + 1e-9);
  assert.equal(sim.state.locomotion.blocked, true);
  assert.equal(sim.state.moving, 0);
  assert.equal(sim.state.locomotion.speed, 0);
  assert.equal(sim.state.locomotion.moveBlend, 0);
  assert.equal(sim.state.locomotion.sprintBlend, 0);
  const phase = sim.state.locomotion.stridePhase, distance = sim.state.locomotion.distance;
  advanceAt(sim, .5, 60, { moveX: 1, sprint: true });
  assert.equal(sim.state.locomotion.stridePhase, phase);
  assert.equal(sim.state.locomotion.distance, distance);
  sim.step(1 / 60, { moveX: 1, dash: true });
  advanceAt(sim, .25, 60, { moveX: 1 });
  assert.equal(sim.state.locomotion.dashBlend, 0);
  assert.equal(sim.state.locomotion.speed, 0);
  assert.equal(sim.state.locomotion.stridePhase, phase);
  advanceAt(sim, 1, 60, { moveX: 1, moveY: 1 });
  assert(sim.state.player.z < -2.5, 'Smoothing prevented valid sliding along the wall');
  assert(sim.state.player.x <= .52 + 1e-9);
  assert(sim.state.locomotion.forward > 2.8 && Math.abs(sim.state.locomotion.strafe) < .001);
  assert.equal(sim.blocked(sim.state.player.x, sim.state.player.z), false);
});

test('Dash travel is bounded and frame-rate independent with no retained boost or extended immunity', () => {
  const distances = [];
  for (const fps of [20, 30, 60, 120]) {
    const sim = FSimulation.create(fixture()), dt = 1 / fps;
    sim.step(dt, { dash: true });
    assert(sim.state.player.dashing > 0);
    advanceAt(sim, .35 - dt, fps);
    assert.equal(sim.state.player.dashing, 0);
    assert.equal(sim.state.locomotion.speed, 0);
    assert.equal(sim.state.locomotion.dashBlend, 0);
    const position = sim.state.player.z;
    advanceAt(sim, .4, fps);
    assert.equal(sim.state.player.z, position, 'Dash retained a sliding impulse after it ended');
    sim.hurt(20); assert.equal(sim.state.player.hp, 80, 'Dash immunity outlived its movement window');
    assert.equal(events(sim, 'dash').length, 1);
    distances.push(sim.state.locomotion.distance);
  }
  assert(distances.every(d => d > 2 && d < 2.4));
  assert(Math.max(...distances) - Math.min(...distances) < .001);
});

test('Version-one checkpoints restore at rest, including a saved dash, without animation spikes or movement creep', () => {
  const world = fixture(), original = FSimulation.create(world), restored = FSimulation.create(world);
  advanceAt(original, 1, 60, { moveY: 1 });
  const data = JSON.parse(JSON.stringify(original.snapshot()));
  assert.equal(data.version, 1);
  assert.equal('locomotion' in data.state, false, 'Transient motion should not require a new checkpoint format');
  const motionRef = restored.state.locomotion;
  assert.equal(restored.restore(data), true);
  assert.equal(restored.state.locomotion, motionRef);
  for (const key of ['vx', 'vz', 'speed', 'forward', 'strafe', 'distance', 'stridePhase', 'moveBlend', 'sprintBlend', 'dashBlend', 'accelForward', 'accelStrafe']) {
    assert.equal(restored.state.locomotion[key], 0, `${key} was not reset for checkpoint presentation`);
  }
  const position = [restored.state.player.x, restored.state.player.z];
  advanceAt(restored, .5, 60);
  assert.deepEqual([restored.state.player.x, restored.state.player.z], position);
  data.state.player.dashing = .15; data.state.player.dash = 1.5;
  assert.equal(restored.restore(data), true);
  advanceAt(restored, .3, 60);
  assert.deepEqual([restored.state.player.x, restored.state.player.z], position,
    'Restoring a previous dash launched an unrequested movement');
  assert.equal(restored.state.locomotion.dashBlend, 0);
  assert.equal(restored.state.player.dashing, 0);
});

test('Sight has a field of view and lost contact preserves a last observation instead of following a hidden player', () => {
  const unaware = FSimulation.create(fixture({ enemies: [{ x: 0, z: -10, type: 2, yaw: 0 }] }));
  advance(unaware, .8);
  assert.equal(unaware.state.enemies[0].awareness, 'patrol', 'A quiet player behind the turret should not be detected');
  assert.equal(events(unaware, 'alerted').length, 0);
  const world = fixture({
    spawn: { x: -5, z: 0, yaw: 0 },
    enemies: [{ x: -5, z: -8, type: 0 }],
    colliders: [{ minX: -.5, maxX: .5, minZ: -25, maxZ: 25, minY: 0, maxY: 4 }],
  });
  const first = FSimulation.create(world), second = FSimulation.create(world);
  for (const sim of [first, second]) { sim.state.enemies[0].cooldown = 30; sim.step(.025); }
  Object.assign(first.state.player, { x: 5, z: 0 });
  Object.assign(second.state.player, { x: 13, z: -15 });
  for (let i = 0; i < 240; i++) {
    first.step(.025); second.step(.025);
    assert.equal(JSON.stringify(first.snapshot().state.enemies), JSON.stringify(second.snapshot().state.enemies),
      'Two different hidden player positions changed the same enemy knowledge or route');
  }
  const enemy = first.state.enemies[0];
  assert.equal(enemy.seen, false);
  assert.equal(enemy.awareness, 'search');
  assert.deepEqual([enemy.lastSeenX, enemy.lastSeenZ], [-5, 0]);
  assert(enemy.x < -.88, 'A search crossed the wall toward the hidden player');
  advance(first, 3);
  assert.equal(enemy.awareness, 'patrol');
  assert.equal(enemy.hasMemory, false);
  assert.equal(enemy.active, false);
  assert.equal(events(first, 'alerted').length, 1, 'Continuous searching replayed the initial alert');
});

test('Unalerted mobile guards patrol locally and all movement remains on physical walkable ground', () => {
  const world = fixture({
    spawn: { x: 25, z: 25, yaw: 0 }, enemies: [{ x: 0, z: 0, type: 0 }],
    walkable: [{ x: 0, z: 0, w: 7, d: 7 }, { x: 25, z: 25, w: 8, d: 8 }],
    colliders: [{ minX: .8, maxX: 1.5, minZ: -1, maxZ: 1, minY: 0, maxY: 2.4 }],
  });
  const sim = FSimulation.create(world), enemy = sim.state.enemies[0];
  let distance = 0;
  for (let frame = 0; frame < 400; frame++) {
    const x = enemy.x, z = enemy.z; sim.step(.025);
    distance += Math.hypot(enemy.x - x, enemy.z - z);
    assert.equal(sim.blocked(enemy.x, enemy.z, .38), false);
    assert(Math.abs(enemy.x) <= 3.5 && Math.abs(enemy.z) <= 3.5);
  }
  assert(distance > 5, 'Patrol was only a state label with no physical route');
  assert.equal(enemy.awareness, 'patrol');
  assert.equal(enemy.hasMemory, false);
});

test('Actual weapon and pulse noises carry their event position, with shorter hearing through an opaque wall', () => {
  const wall = { minX: -.1, maxX: .1, minZ: -25, maxZ: 25, minY: 0, maxY: 4 };
  function noisy(kind, enemyX) {
    const sim = FSimulation.create(fixture({ spawn: { x: -4, z: 0, yaw: 0 }, colliders: [wall], enemies: [{ x: enemyX, z: 0, type: 2 }] }));
    if (kind === 'pulse') sim.pulse();
    else { sim.state.weapon = kind === 'fracture' ? 1 : 0; sim.fire(); }
    return sim;
  }
  const quiet = noisy('shot', 8);
  assert.equal(quiet.state.enemies[0].hasMemory, false, 'Ordinary fire was heard beyond its attenuated range');
  for (const sim of [noisy('shot', 4), noisy('fracture', 8), noisy('pulse', 4)]) {
    const enemy = sim.state.enemies[0];
    assert.equal(enemy.awareness, 'investigate');
    assert.equal(enemy.seen, false);
    assert.deepEqual([enemy.lastSeenX, enemy.lastSeenZ], [-4, 0]);
    assert.equal(enemy.hp, enemy.maxHp, 'Sound must not also penetrate cover as damage');
    assert.equal(events(sim, 'alerted').length, 1);
    sim.state.player.z = 12; advance(sim, .5);
    assert.deepEqual([enemy.lastSeenX, enemy.lastSeenZ], [-4, 0], 'The recorded noise followed its source after the event');
  }
});

test('An observer warns nearby allies with known coordinates but a blind relay cannot alert the entire map', () => {
  const sim = FSimulation.create(fixture({
    spawn: { x: -4, z: 0, yaw: 0 },
    colliders: [{ minX: -.5, maxX: .5, minZ: -25, maxZ: 25, minY: 0, maxY: 4 }],
    enemies: [{ x: -4, z: -6, type: 2 }, { x: 4, z: -6, type: 2 }, { x: 15, z: -6, type: 2 }],
  }));
  sim.step(.025);
  const [observer, ally, remote] = sim.state.enemies;
  assert.equal(observer.awareness, 'engage');
  assert.equal(ally.awareness, 'investigate');
  assert.equal(ally.seen, false);
  assert.deepEqual([ally.lastSeenX, ally.lastSeenZ], [-4, 0]);
  assert.equal(remote.hasMemory, false);
  advance(sim, 2);
  assert.equal(remote.awareness, 'patrol', 'An ally relayed hearsay as a fresh direct sighting');
  assert.equal(events(sim, 'alerted').length, 2, 'Alert sounds repeated every perception update');
  assert.equal(sim.state.enemies[1].x, 4, 'A turret moved while investigating a radio report');
});

test('A scout physically takes an alternate route around a solid obstacle to reach a flank', () => {
  const wall = { minX: 1, maxX: 4, minZ: -8, maxZ: -3, minY: 0, maxY: 3 };
  const sim = FSimulation.create(fixture({ colliders: [wall], enemies: [{ x: 0, z: -8, type: 0 }] }));
  const enemy = sim.state.enemies[0]; enemy.cooldown = 30;
  sim.step(.025);
  assert.equal(enemy.tactic, 'flank');
  assert(enemy.goalX > wall.maxX && enemy.path.length >= 2, 'Flank had no navigable alternative to the blocked straight line');
  let usedEnd = false, crossed = false;
  for (let frame = 0; frame < 260; frame++) {
    sim.step(.025);
    assert.equal(sim.blocked(enemy.x, enemy.z, .38), false);
    if (enemy.x > 1.5 && enemy.x < 3.5 && enemy.z < wall.minZ - .38) usedEnd = true;
    if (enemy.x > wall.maxX + .38) crossed = true;
  }
  assert(usedEnd, 'The scout did not travel around the obstacle end');
  assert(crossed, 'The scout stayed pressed against the obstacle instead of reaching its other side');
  assert.equal(events(sim, 'enemyShot').length, 0);
});

test('A wounded scout reaches real occluding cover, waits, then peeks; the whole tactical sequence survives a checkpoint', () => {
  const world = fixture({
    colliders: [{ minX: 1, maxX: 3, minZ: -8, maxZ: -6, minY: 0, maxY: 2.5 }],
    enemies: [{ x: -25, z: -25, type: 2 }, { x: 25, z: -25, type: 2 }, { x: 0, z: -8, type: 0 }],
  });
  const sim = FSimulation.create(world), restored = FSimulation.create(world), enemy = sim.state.enemies[2];
  enemy.hp = 1; enemy.cooldown = 0; sim.step(.025);
  assert.equal(enemy.tactic, 'cover');
  assert.equal(enemy.holdTime, 1.4, 'The id2 cover duration must remain a serializable exact bound');
  assert.equal(sim.sight(0, 0, enemy.goalX, enemy.goalZ), false, 'Chosen cover did not actually occlude the known threat');
  assert.equal(restored.restore(sim.snapshot()), true, 'A real cover plan failed validation immediately after creation');
  advance(sim, 2.35);
  assert.equal(enemy.tactic, 'cover');
  assert(Math.hypot(enemy.x - enemy.goalX, enemy.z - enemy.goalZ) < .16, 'The scout did not reach its cover');
  assert.equal(sim.sight(0, 0, enemy.x, enemy.z), false);
  assert(enemy.holdTime > 0 && enemy.holdTime < 1.4);
  assert.equal(events(sim, 'enemyShot').length, 0, 'The scout fired while hiding behind cover');
  sim.state.player.yaw = Math.atan2(enemy.x, -enemy.z); sim.fire();
  assert.equal(enemy.hp, 1, 'The claimed cover blocked an eye ray but failed to stop the actual weapon ray');
  assert.equal(restored.restore(sim.snapshot()), true);
  let peeked = false;
  for (let frame = 0; frame < 200; frame++) {
    sim.step(.025); restored.step(.025);
    if (enemy.tactic !== 'cover' && sim.sight(0, 0, enemy.x, enemy.z)) peeked = true;
    assert.equal(JSON.stringify(restored.snapshot()), JSON.stringify(sim.snapshot()), 'Tactical memory, route or cover timing changed after restoring');
  }
  assert(peeked, 'Taking cover became a permanent hidden state');
  assert(events(sim, 'enemyShot').length > 0, 'The scout never resumed an exposed, telegraphed attack after peeking');
});

test('Squads separate collision-safely and presentation speed measures displacement instead of intentions', () => {
  const sim = FSimulation.create(fixture({ enemies: [{ x: -.05, z: -8, type: 0 }, { x: .05, z: -8, type: 0 }, { x: 0, z: -9, type: 1 }] }));
  for (const e of sim.state.enemies) e.cooldown = 30;
  for (let frame = 0; frame < 100; frame++) {
    const before = sim.state.enemies.map(e => [e.x, e.z]); sim.step(.025);
    for (let i = 0; i < sim.state.enemies.length; i++) {
      const e = sim.state.enemies[i];
      assert(Math.abs(e.moveSpeed - Math.hypot(e.x - before[i][0], e.z - before[i][1]) / .025) < 1e-9);
      assert.equal(sim.blocked(e.x, e.z, .38), false);
    }
  }
  const [a, b] = sim.state.enemies;
  assert(Math.hypot(a.x - b.x, a.z - b.z) > .9, 'Two members of the squad remained stacked');
  const turret = FSimulation.create(fixture({ enemies: [{ x: 0, z: -8, type: 2 }] }));
  advance(turret, 1);
  assert.equal(turret.state.enemies[0].moveSpeed, 0);
});

test('Even a committed burst with its barrel against a wall cannot create a projectile behind that wall', () => {
  const sim = FSimulation.create(fixture({
    spawn: { x: 0, z: 1, yaw: 0 },
    colliders: [{ minX: -20, maxX: 20, minZ: -.1, maxZ: 0, minY: 0, maxY: 4 }],
    enemies: [{ x: 0, z: -.49, type: 2 }],
  }));
  const enemy = sim.state.enemies[0];
  Object.assign(enemy, { active: true, burstLeft: 3, burstWait: 0, attackState: 'burst', aimX: 0, aimY: 1.45, aimZ: 1 });
  advance(sim, 1.5);
  assert.equal(events(sim, 'enemyShot').length, 3, 'The test did not exercise the existing committed burst');
  assert.equal(sim.state.player.hp, 100, 'A muzzle offset spawned a projectile on the far side of the wall');
  assert.equal(sim.state.bullets.length, 0);
});

test('A locally planned investigation travels the same collision-respecting route at 20–120 steps per second', () => {
  const positions = [];
  for (const fps of [20, 30, 60, 120]) {
    const sim = FSimulation.create(fixture({
      colliders: [{ minX: -1.5, maxX: 1.5, minZ: -6, maxZ: -4, minY: 0, maxY: 4 }],
      enemies: [{ x: 0, z: -10, type: 1 }],
    }));
    const enemy = sim.state.enemies[0]; enemy.cooldown = 30; sim.fire();
    assert.equal(enemy.awareness, 'investigate');
    advanceAt(sim, 3, fps);
    assert.equal(sim.blocked(enemy.x, enemy.z, .38), false);
    assert(Math.hypot(enemy.x, enemy.z + 10) > 2.5, 'The heard shot never caused a physical investigation');
    positions.push([enemy.x, enemy.z]);
  }
  for (const [x, z] of positions) assert(Math.hypot(x - positions[0][0], z - positions[0][1]) < .08,
    'AI displacement depends on the display frame rate');
});

test('Malformed tactical checkpoints fail atomically while compatible legacy saves import only their stored aim', () => {
  const world = fixture({
    spawn: { x: -5, z: 0, yaw: 0 }, enemies: [{ x: -5, z: -8, type: 0 }],
    colliders: [{ minX: -.5, maxX: .5, minZ: -25, maxZ: 25, minY: 0, maxY: 4 }],
  });
  const sim = FSimulation.create(world); sim.state.enemies[0].cooldown = 0; sim.step(.025);
  Object.assign(sim.state.player, { x: 5, z: 0 }); advance(sim, .3);
  const original = JSON.stringify(sim.snapshot());
  const invalid = [
    d => { d.aiVersion = 9; },
    d => { d.state.enemies[0].awareness = 'omniscient'; },
    d => { d.state.enemies[0].tactic = 'teleport'; },
    d => { d.state.enemies[0].hasMemory = 'true'; },
    d => { d.state.enemies[0].lastSeenX = Infinity; },
    d => { d.state.enemies[0].memory = 90; },
    d => { d.state.enemies[0].alert = 2; },
    d => { d.state.enemies[0].goalX = 0; d.state.enemies[0].goalZ = 0; },
    d => { d.state.enemies[0].path = [-1]; },
    d => { d.state.enemies[0].path = [sim.nav.idx(0, 0)]; },
    d => { d.state.enemies[0].pathAt = d.state.enemies[0].path.length + 1; },
    d => { d.state.enemies[0].senseWait = NaN; },
    d => { d.state.enemies[0].holdTime = 1.41; },
    d => { delete d.aiVersion; },
  ];
  for (const corrupt of invalid) {
    const data = JSON.parse(original); corrupt(data);
    assert.equal(sim.restore(data), false);
    assert.equal(JSON.stringify(sim.snapshot()), original, 'Rejected tactical data partially mutated the active game');
  }
  const legacy = JSON.parse(original); delete legacy.aiVersion;
  const keys = ['awareness', 'tactic', 'hasMemory', 'lastSeenX', 'lastSeenZ', 'memory', 'alert', 'seen', 'senseWait', 'thinkWait', 'shareWait', 'alertWait', 'coverWait', 'holdTime', 'planWait', 'patrolIndex', 'searchIndex', 'goalX', 'goalZ', 'pathAt', 'stuck', 'moveSpeed', 'path', 'lastSeenY', 'observedVX', 'observedVZ', 'observedAt', 'sleeping', 'observedVY', 'dodgeWait', 'dodgeDelay', 'dodgeTime', 'dodgeX', 'dodgeZ'];
  for (const e of legacy.state.enemies) for (const key of keys) delete e[key];
  const restored = FSimulation.create(world);
  assert.equal(restored.restore(legacy), true);
  const enemy = restored.state.enemies[0];
  assert.equal(enemy.awareness, 'search');
  assert.equal(enemy.seen, false);
  assert.deepEqual([enemy.lastSeenX, enemy.lastSeenZ], [legacy.state.enemies[0].aimX, legacy.state.enemies[0].aimZ]);
  assert.notEqual(enemy.lastSeenX, restored.state.player.x, 'Importing an old save revealed the hidden player position');
});

test('The Custodian keeps its last-known search inside its arena instead of getting stranded in a service route', () => {
  const world = fixture({
    enemies: [{ x: 0, z: -12, type: 3 }],
    colliders: [{ minX: 5, maxX: 5.2, minZ: -25, maxZ: 25, minY: 0, maxY: 4 }],
  });
  const sim = FSimulation.create(world), boss = sim.state.enemies[0]; boss.cooldown = 30;
  sim.step(.025); Object.assign(sim.state.player, { x: 15, z: 0 });
  for (let frame = 0; frame < 400; frame++) {
    sim.step(.025);
    assert(Math.abs(boss.x) <= 4.01 && Math.abs(boss.z + 12) <= 4.01);
    assert.equal(sim.blocked(boss.x, boss.z, 1.05), false);
  }
  assert.equal(boss.awareness, 'patrol');
  assert.equal(boss.hasMemory, false);
});

test('Real outdoor geometry supports tactical updates and exact cover checkpoints without invalid enemy positions', () => {
  const world = FWorld.create('96', 1), sim = FSimulation.create(world);
  const enemy = sim.state.enemies[2];
  const positions = Array.from({ length: 16 }, (_, i) => ({ x: enemy.x + Math.cos(i * Math.PI / 8) * 3, z: enemy.z + Math.sin(i * Math.PI / 8) * 3 }));
  const position = positions.find(p => !sim.blocked(p.x, p.z) && sim.sight(p.x, p.z, enemy.x, enemy.z));
  assert(position, 'No reachable observation point beside the generated squad');
  Object.assign(sim.state.player, { ...position, y: sim.ground(position.x, position.z) });
  enemy.hp = 1; enemy.cooldown = 10;
  for (let frame = 0; frame < 180; frame++) {
    sim.step(1 / 60);
    for (const e of sim.state.enemies) if (e.hp > 0) {
      assert.equal(sim.blocked(e.x, e.z, e.type === 3 ? 1.05 : .38), false);
      assert.equal(FWorld.isWalkable(world, e.x, e.z, .1), true);
    }
  }
  const data = sim.snapshot(), restored = FSimulation.create(world);
  assert.equal(restored.restore(data), true);
  assert.equal(JSON.stringify(restored.snapshot()), JSON.stringify(data));
  for (let frame = 0; frame < 60; frame++) { sim.step(1 / 60); restored.step(1 / 60); }
  assert.equal(JSON.stringify(restored.snapshot()), JSON.stringify(sim.snapshot()));
});

function reliefFixture(extra = {}) {
  return fixture({
    generation: 5, bounds: { minX: -12, maxX: 20, minZ: -7, maxZ: 7 },
    spawn: { x: -6, y: 0, z: 0, yaw: Math.PI / 2 },
    walkable: [
      { x: -5, z: 0, w: 10, d: 10, y: 0 },
      { x: 4, z: 0, w: 8, d: 10, y: 1.6, slopeX: .4 },
      { x: 13, z: 0, w: 10, d: 10, y: 3.2 },
    ],
    cores: [{ id: 0, x: 10, y: 3.2, z: 3 }, { id: 1, x: 13, y: 3.2, z: 3 }, { id: 2, x: 16, y: 3.2, z: 3 }],
    exit: { x: 16, y: 3.2, z: -3 }, ...extra,
  });
}
function liftFixture(extra = {}) {
  return fixture({
    generation: 5, bounds: { minX: -8, maxX: 12, minZ: -5, maxZ: 5 },
    spawn: { x: -3, y: 0, z: 0, yaw: 0 },
    walkable: [{ x: -3, z: 0, w: 6, d: 6, y: 0 }, { x: 2, z: 0, w: 4, d: 4, y: 0 }, { x: 7, z: 0, w: 6, d: 6, y: 3.2 }],
    mechanisms: [{ id: 'power', x: -3, y: 0, z: 1, name: 'Alimentation du monte-charge', kind: 'breaker', required: true }],
    doors: [{ id: 'gate', x: 0, z: 0, y: 0, w: .3, d: 4, h: 3, requires: 'power' }],
    lifts: [{ id: 'lift', x: 2, z: 0, w: 4, d: 4, minY: 0, maxY: 3.2, speed: 1.6, requires: 'power', lowerCall: { x: -.8, y: 0, z: 0 }, upperCall: { x: 4.8, y: 3.2, z: 0 } }],
    cores: [{ id: 0, x: 2, y: 3.2, z: 0 }, { id: 1, x: 7, y: 3.2, z: 2 }, { id: 2, x: 9, y: 3.2, z: 2 }],
    exit: { x: 9, y: 3.2, z: -2 }, ...extra,
  });
}
function boardLift(sim) {
  assert.equal(sim.interact(), true, 'Power console must be reachable at the entry');
  advance(sim, 1.2);
  walkTo(sim, { x: 2, z: 0 });
  assert.equal(sim.state.player.y, 0);
  assert.equal(sim.nearestInteraction()?.kind, 'lift');
}

test('Ordinary walking follows the actual ramp smoothly; an unconnected high ledge rejects walking and dash', () => {
  const sim = FSimulation.create(reliefFixture());
  let previous = sim.state.player.y, climbed = 0;
  walkTo(sim, { x: 12, z: 0 }, () => {
    const p = sim.state.player;
    assert(Math.abs(p.y - previous) <= .045, 'Player snapped vertically instead of walking the slope');
    assert(Math.abs(p.y - sim.ground(p.x, p.z)) < 1e-9);
    climbed += Math.max(0, p.y - previous); previous = p.y;
  });
  assert(Math.abs(climbed - 3.2) < 1e-8);
  assert.equal(sim.state.player.y, 3.2);
  walkTo(sim, { x: -6, z: 0 }); assert.equal(sim.state.player.y, 0);
  const ledge = FSimulation.create(reliefFixture({ walkable: [{ x: -4, z: 0, w: 12, d: 10, y: 0 }, { x: 10, z: 0, w: 16, d: 10, y: 3.2 }] }));
  ledge.move(ledge.state.player, 30, 0);
  assert(ledge.state.player.x <= 2 + 1e-7); assert.equal(ledge.state.player.y, 0);
  advance(ledge, .3, { moveY: 1, dash: true });
  assert(ledge.state.player.x <= 2 + 1e-7, 'Dash crossed an unsupported vertical step');
  assert.equal(ledge.nav.canTraverse(1.6, 0, 2.4, 0), false);
});

test('Raised architecture collides at body height; terrain intercepts low shots and correctly aimed high shots hit', () => {
  const world = reliefFixture({
    enemies: [{ x: 12, y: 3.2, z: 0, type: 2 }],
    colliders: [{ minX: 12.5, maxX: 13.5, minZ: 2, maxZ: 3, minY: 3.2, maxY: 4.6 }],
  });
  const sim = FSimulation.create(world), enemy = sim.state.enemies[0];
  assert.equal(sim.blocked(13, 2.5), true);
  assert.equal(sim.blocked(13, 2.5, .28, 0), false, 'A raised object was treated as a floor-level obstruction');
  assert(Math.abs(sim.ray([-6, 1.62, 0], [1, 0, 0]) - 10.05) < 1e-8);
  assert.equal(sim.fire(), true); assert.equal(enemy.hp, 4, 'A horizontal low shot travelled through the hillside');
  advance(sim, .18);
  sim.state.player.pitch = Math.atan2(enemy.y - 1.62, enemy.x + 6);
  assert.equal(sim.fire(), true); assert.equal(enemy.hp, 3);
  assert.equal(enemy.baseY, 3.2); assert(Math.abs(enemy.y - 4.8) < 1e-9);
});

test('F is an edge-triggered interaction, power opens a physical gate, and lifted player cannot collect from another height', () => {
  const sim = FSimulation.create(liftFixture()), p = sim.state.player;
  assert.equal(sim.nearestInteraction().id, 'power');
  sim.move(p, 6, 0); assert(p.x < -.4, 'A closed gate allowed passage');
  sim.move(p, -3, 0);
  sim.step(.025, { interact: true });
  assert.equal(sim.state.mechanisms[0].active, true);
  assert.equal(events(sim, 'mechanism').length, 1, 'Console label overwrote the event type');
  assert.equal(events(sim, 'mechanism')[0].label, 'Alimentation du monte-charge');
  advance(sim, 1.2, { interact: true });
  assert.equal(events(sim, 'mechanism').length, 1); assert.equal(sim.state.doors[0].open, true);
  assert.equal(sim.blocked(0, 0), false);
  walkTo(sim, { x: 2, z: 0 });
  assert.equal(sim.state.relays, 0, 'Relay was collected through an entire storey');
  sim.step(.025, { interact: true });
  advance(sim, 2.3, { interact: true });
  assert(Math.abs(p.y - 3.2) < 1e-9);
  assert.equal(sim.state.relays, 1);
  assert.equal(events(sim, 'liftStart').length, 1, 'Held F reversed the lift on arrival');
  assert.equal(events(sim, 'liftStop').length, 1);
  assert.equal(events(sim, 'liftStop')[0].carrying, true);
  assert.equal(sim.state.lifts[0].moving, false);
});

test('Lift carries feet continuously, blocks premature exit to a high landing, and can be recalled without a passenger', () => {
  const sim = FSimulation.create(liftFixture()), p = sim.state.player; boardLift(sim);
  assert.equal(sim.interact(), true);
  advance(sim, .6);
  assert(Math.abs(p.y - .96) < 1e-8); assert(Math.abs(p.y - sim.state.lifts[0].y) < 1e-9);
  sim.move(p, 5, 0);
  assert(p.x < 4.001, 'Player left the cabin into an inaccessible upper storey');
  assert(p.y < 1);
  advance(sim, 1.5);
  assert(Math.abs(p.y - 3.2) < 1e-9, 'Standing near the cabin edge lost the moving support');
  walkTo(sim, { x: 2, z: 0 });
  assert.equal(sim.interact(), true); // Send down, step off before it leaves the upper dock.
  sim.move(p, 3, 0); assert.equal(p.y, 3.2);
  advance(sim, 2.1);
  assert.equal(sim.state.lifts[0].y, 0);
  assert.equal(events(sim, 'liftStop').at(-1).carrying, false);
  assert.equal(sim.nearestInteraction().label, 'Appeler l’ascenseur');
  assert.equal(sim.interact(), true); advance(sim, 2.1);
  assert.equal(sim.state.lifts[0].y, 3.2); assert.equal(events(sim, 'liftStop').at(-1).carrying, false);
  walkTo(sim, { x: 2, z: 0 }); assert.equal(sim.interact(), true); advance(sim, 2.1);
  assert.equal(p.y, 0); assert.equal(events(sim, 'liftStop').at(-1).carrying, true);
});

test('A descending lift stops above a body underneath, then resumes after the obstruction leaves', () => {
  const sim = FSimulation.create(liftFixture()), p = sim.state.player; boardLift(sim);
  assert.equal(sim.interact(), true); sim.move(p, -3, 0); advance(sim, 2.1);
  assert.equal(sim.state.lifts[0].y, 3.2); assert.equal(p.y, 0);
  assert.equal(sim.interact(), true); sim.move(p, 3, 0);
  advance(sim, 2.1);
  assert.equal(p.y, 0); assert(sim.state.lifts[0].y >= 2.05 - 1e-8, 'The deck descended through the player’s head');
  assert.equal(sim.state.lifts[0].moving, true);
  sim.move(p, -3, 0); advance(sim, 1.6);
  assert.equal(sim.state.lifts[0].y, 0); assert.equal(sim.state.lifts[0].moving, false);
});

test('A lift checkpoint resumes halfway between floors and corrupted mechanism, gate or platform state is rejected atomically', () => {
  const world = liftFixture(), sim = FSimulation.create(world); boardLift(sim); sim.interact(); advance(sim, .7);
  const saved = sim.snapshot(), restored = FSimulation.create(world);
  assert.equal(saved.systemsVersion, 1); assert.equal(saved.aiVersion, 3); assert.equal(saved.physicsVersion, 1);
  assert.equal(restored.restore(saved), true);
  assert.equal(JSON.stringify(restored.snapshot()), JSON.stringify(saved));
  assert.equal(restored.state.player.y, restored.state.lifts[0].y);
  advance(sim, 1.4); advance(restored, 1.4);
  assert.equal(JSON.stringify(restored.snapshot()), JSON.stringify(sim.snapshot()));
  const original = JSON.stringify(restored.snapshot());
  for (const corrupt of [
    d => { d.state.mechanisms[0] = false; }, d => { d.state.doors[0] = 1.1; },
    d => { d.state.lifts[0].y = 8; }, d => { d.state.lifts[0].powered = false; },
    d => { d.state.lifts[0].target = 1.4; }, d => { d.state.player.y = 1.4; },
    d => { delete d.systemsVersion; },
  ]) {
    const data = JSON.parse(original); corrupt(data);
    assert.equal(restored.restore(data), false);
    assert.equal(JSON.stringify(restored.snapshot()), original);
  }
});

test('Relay exit also requires each real mechanism; activation does not retrigger and old worlds remain ungated', () => {
  const world = fixture({
    mechanisms: [{ id: 0, x: 0, y: 0, z: 2, name: 'Vanne', kind: 'valve', required: true }],
    cores: [0, 1, 2].map(id => ({ id, x: 0, z: 0 })), exit: { x: 0, z: 0 },
  });
  const sim = FSimulation.create(world); sim.step(.025);
  assert.equal(sim.state.relays, 3); assert.equal(sim.state.won, false);
  assert.equal(sim.interact(), true); assert.equal(sim.interact(), false);
  sim.step(.025); assert.equal(sim.state.won, true);
  const old = FSimulation.create({ ...world, mechanisms: [] }); old.step(.025); assert.equal(old.state.won, true);
});

test('Projectiles and hot vents are height-aware, and a lift deck blocks a ray from below', () => {
  const sim = FSimulation.create(liftFixture({ hazards: [{ x: -3, y: 3.2, z: 0, r: 2, active: 3, period: 6, phase: 0 }] }));
  sim.state.bullets.push({ x: -3, y: 4.6, z: -.1, dx: 0, dy: 0, dz: 1, life: .2, damage: 100 });
  sim.step(.025); assert.equal(sim.state.player.hp, 100, 'Damage crossed a complete storey');
  boardLift(sim); sim.interact(); sim.move(sim.state.player, -3, 0); advance(sim, 2.1);
  assert(Math.abs(sim.ray([2, 1, 0], [0, 1, 0], 10) - 2) < 1e-8, 'A projectile passed upward through the elevator deck');
  sim.state.player.y = 3.2; sim.state.player.x = 5;
  sim.state.bullets.push({ x: 5, y: 4.6, z: -.1, dx: 0, dy: 0, dz: 1, life: .2, damage: 10 });
  sim.step(.025); assert.equal(sim.state.player.hp, 90, 'Upper-storey projectile missed a player at the matching height');
});

test('Advanced squads physically assault, flank or suppress from distinct positions', () => {
  const results = {};
  for (const role of ['assault', 'flanker', 'suppressor']) {
    const sim = FSimulation.create(fixture({ combat: true, enemies: [{ x: 0, z: -12, type: 0, role, squadId: 0 }] }));
    sim.state.enemies[0].cooldown = 30; advance(sim, 2);
    const e = sim.state.enemies[0]; assert.equal(e.seen, true); assert.equal(sim.blocked(e.x, e.z, .38), false);
    results[role] = { x: e.x, z: e.z, distance: Math.hypot(e.x, e.z) };
  }
  assert(results.assault.distance < 8, 'Assault role never closed the distance');
  assert(Math.abs(results.flanker.x) > 2, 'Flanker did not physically open a side lane');
  assert(Math.hypot(results.suppressor.x, results.suppressor.z + 12) < .05, 'Suppressor abandoned its useful firing position');
});

test('Advanced aim leads observed motion, then remains committed when the player changes direction', () => {
  const sim = FSimulation.create(fixture({ combat: true, enemies: [{ x: 0, z: -12, type: 2 }] })), e = sim.state.enemies[0];
  e.cooldown = 30; advance(sim, .5, { moveX: 1 }); e.cooldown = 0; sim.step(.025, { moveX: 1 });
  assert.equal(e.attackState, 'aim'); assert(e.observedVX > 3.5); assert(e.aimX > sim.state.player.x + 1);
  const locked = [e.aimX, e.aimY, e.aimZ]; advance(sim, .3, { moveX: -1 });
  assert.deepEqual([e.aimX, e.aimY, e.aimZ], locked, 'Telegraphed shot tracked the player after committing');
});

test('An advanced gunner does not shoot through a squad mate and fires after the lane clears', () => {
  const sim = FSimulation.create(fixture({ combat: true, enemies: [{ x: 0, z: -12, type: 2 }, { x: 0, z: -6, type: 2 }] }));
  const [rear, front] = sim.state.enemies; rear.cooldown = 0; front.cooldown = 30; front.stun = .85; sim.step(.025);
  assert.notEqual(rear.attackState, 'aim', 'Rear gunner aimed through a friendly body');
  advance(sim, .775);
  assert.equal(sim.state.bullets.some(b => b.owner === rear.id), false);
  if (rear.attackState === 'aim') {
    const dx = -rear.x, dz = -rear.z, t = Math.max(0, Math.min(1, ((front.x - rear.x) * dx + (front.z - rear.z) * dz) / (dx * dx + dz * dz)));
    assert(Math.hypot(rear.x + dx * t - front.x, rear.z + dz * t - front.z) >= .57, 'Mobile gunner fired before actually clearing its ally');
  }
  sim.move(front, 4, 0, .38); advance(sim, .9);
  assert(sim.state.bullets.some(b => b.owner === rear.id), 'A clear firing lane never enabled the attack');
});

test('Hundreds of real actors retain positions while distant; local searches obey a fixed per-frame budget', () => {
  const near = Array.from({ length: 16 }, (_, i) => ({ x: 8 + (i % 4) * 1.6, z: -3 + Math.floor(i / 4) * 1.6, type: 0, squadId: Math.floor(i / 4) }));
  const far = Array.from({ length: 154 }, (_, i) => ({ x: 100 + (i % 22) * 2, z: -6 + Math.floor(i / 22) * 2, type: i % 3 }));
  const sim = FSimulation.create(fixture({ combat: true, bounds: { minX: -10, maxX: 155, minZ: -12, maxZ: 16 }, enemies: near.concat(far),
    colliders: [{ minX: 3.9, maxX: 4.1, minZ: -12, maxZ: 7, minY: 0, maxY: 4 }],
  }));
  const before = sim.state.enemies.slice(16).map(e => [e.id, e.x, e.z, e.hp]);
  for (const e of sim.state.enemies) e.cooldown = 30;
  sim.fire(); let deferred = 0, planned = 0;
  for (let frame = 0; frame < 90; frame++) {
    sim.step(1 / 60); const stats = sim.state.aiStats;
    assert.equal(stats.alive, 170); assert.equal(stats.awake + stats.dormant, 170);
    assert.equal(stats.dormant, 154); assert(stats.pathSearches <= 2);
    deferred += stats.pathDeferred; planned += stats.pathSearches;
  }
  assert(deferred > 0 && planned > 0, 'Scenario did not exercise bounded expensive pathfinding');
  assert.deepEqual(sim.state.enemies.slice(16).map(e => [e.id, e.x, e.z, e.hp]), before, 'Dormant actors were moved or replaced');
  assert.equal(sim.state.enemies.length, 170);
  Object.assign(sim.state.player, { x: 120, z: 0 }); sim.step(.025);
  assert(sim.state.aiStats.awake >= 154, 'Existing remote squads failed to awaken on approach');
});

test('Infantry navigates down a genuine ramp without changing floor suddenly or losing its body height', () => {
  const sim = FSimulation.create(reliefFixture({ enemies: [{ x: 12, y: 3.2, z: 0, type: 0, role: 'assault' }] }));
  const e = sim.state.enemies[0]; e.cooldown = 30; let last = e.baseY;
  for (let frame = 0; frame < 280; frame++) {
    sim.step(.025);
    assert(Math.abs(e.baseY - last) < .05, 'Enemy teleported between floor levels');
    assert(Math.abs(e.baseY - sim.ground(e.x, e.z)) < 1e-8);
    assert(Math.abs(e.y - e.baseY - 1.35) < 1e-8);
    assert.equal(sim.blocked(e.x, e.z, .38, e.baseY), false); last = e.baseY;
  }
  assert.equal(e.baseY, 0); assert(e.x < 0, 'Enemy never descended to the lower floor');
});

test('A low gunner observes and attacks a player on the upper floor using an elevated aim and projectile', () => {
  const sim = FSimulation.create(reliefFixture({ spawn: { x: 12, y: 3.2, z: 0, yaw: 0 }, enemies: [{ x: -6, y: 0, z: 0, type: 2 }] }));
  const e = sim.state.enemies[0]; e.cooldown = 0; sim.step(.025);
  assert.equal(e.seen, true); assert.equal(e.attackState, 'aim');
  assert(Math.abs(e.lastSeenY - 4.65) < 1e-8); assert.equal(e.aimY, e.lastSeenY);
  advance(sim, .7); assert(sim.state.bullets.some(b => b.dy > .8));
  advance(sim, 3); assert(sim.state.player.hp < 100, 'Height-aware projectile never reached the upper floor');
});

test('An ascending occupied platform stops before carrying the player into a low ceiling', () => {
  const sim = FSimulation.create(liftFixture({ colliders: [{ minX: 0, maxX: 4, minZ: -2, maxZ: 2, minY: 4.5, maxY: 5 }] }));
  boardLift(sim); sim.interact(); advance(sim, 3);
  assert(sim.state.player.y > 2.6 && sim.state.player.y <= 2.7 + 1e-8);
  assert(sim.state.player.y + 1.8 <= 4.5 + 1e-8, 'Head entered the ceiling');
  assert.equal(sim.state.player.y, sim.state.lifts[0].y);
  assert.equal(sim.blocked(sim.state.player.x, sim.state.player.z, .28, sim.state.player.y), false);
});

test('Advanced patrol memory does not reveal a hidden player’s new coordinates or velocity', () => {
  function run(hiddenX) {
    const sim = FSimulation.create(fixture({ combat: true, spawn: { x: -5, z: 0, yaw: 0 }, enemies: [{ x: -5, z: -8, type: 0 }],
      colliders: [{ minX: -.5, maxX: .5, minZ: -25, maxZ: 25, minY: 0, maxY: 4 }],
    }));
    sim.state.enemies[0].cooldown = 30; sim.step(.025);
    Object.assign(sim.state.player, { x: hiddenX, z: 0 }); advance(sim, 1);
    assert.equal(sim.state.enemies[0].seen, false);
    return JSON.stringify(sim.snapshot().state.enemies[0]);
  }
  assert.equal(run(5), run(13), 'Hidden movement changed the enemy’s knowledge or route');
});

function aimAt(sim, x, y, z) {
  const p = sim.state.player, dx = x - p.x, dz = z - p.z;
  p.yaw = Math.atan2(dx, -dz); p.pitch = Math.atan2(y - p.y - 1.62, Math.hypot(dx, dz));
}

test('New heavy and Custodian helmets can be hit at visible height from level ground and an upper terrace, with no headshot bonus', () => {
  for (const type of [1, 3]) for (const playerY of [0, 3.2]) {
    const headY = type === 1 ? 2.04 : 3.09;
    const sim = FSimulation.create(fixture({ generation: 5, spawn: { x: 0, y: playerY, z: 0, yaw: 0 },
      walkable: [{ x: 0, z: 0, w: 60, d: 60, y: 0 }, ...(playerY ? [{ x: 0, z: 0, w: 4, d: 4, y: playerY }] : [])],
      enemies: [{ x: 0, y: 0, z: -6, type }],
    }));
    const e = sim.state.enemies[0], hp = e.hp;
    aimAt(sim, e.x, headY, e.z); assert.equal(sim.fire(), true);
    assert.equal(e.hp, hp - 1, `Helmet missed for type ${type} from altitude ${playerY}`);
    assert.equal(sim.state.hits, 1);
    assert(sim.state.particles.some(q => q.y > headY - .15), 'Impact effect appeared on the belly instead of the struck helmet');
  }
});

test('Added helmet volumes preserve raised-floor alignment, nearest victim and opaque wall occlusion', () => {
  const raised = FSimulation.create(fixture({ generation: 5, spawn: { x: 0, y: 3.2, z: 0, yaw: 0 },
    walkable: [{ x: 0, z: 0, w: 60, d: 60, y: 3.2 }], enemies: [{ x: 0, y: 3.2, z: -6, type: 1 }],
  }));
  aimAt(raised, 0, 3.2 + 2.04, -6); raised.fire(); assert.equal(raised.state.enemies[0].hp, 4);
  const hidden = FSimulation.create(fixture({ generation: 5, enemies: [{ x: 0, z: -7, type: 1 }, { x: 0, z: -10, type: 3 }],
    colliders: [{ minX: -3, maxX: 3, minZ: -5, maxZ: -4.8, minY: 0, maxY: 5 }],
  }));
  aimAt(hidden, 0, 2.04, -7); hidden.fire(); assert.deepEqual(hidden.state.enemies.map(e => e.hp), [5, 30]);
  const near = FSimulation.create(fixture({ generation: 5, enemies: [{ x: 0, z: -3, type: 1 }, { x: 0, z: -7, type: 3 }],
    colliders: [{ minX: -3, maxX: 3, minZ: -9, maxZ: -8.8, minY: 0, maxY: 5 }],
  }));
  for (const e of near.state.enemies) e.cooldown = 30;
  aimAt(near, 0, 2.04, -3); near.fire(); assert.deepEqual(near.state.enemies.map(e => e.hp), [4, 30]);
  advance(near, .18); aimAt(near, 0, 1.05, -3); near.fire(); assert.deepEqual(near.state.enemies.map(e => e.hp), [3, 30]);
});

test('Helmet targeting does not enlarge world collision, grant extra health, or alter legacy torso fixtures', () => {
  const legacy = FSimulation.create(fixture({ enemies: [{ x: 0, z: -6, type: 1 }] }));
  aimAt(legacy, 0, 2.04, -6); legacy.fire(); assert.equal(legacy.state.enemies[0].hp, 5);
  const wall = { minX: .8, maxX: 1, minZ: -10, maxZ: 10, minY: 0, maxY: 4 };
  const modern = FSimulation.create(fixture({ generation: 5, enemies: [{ x: 0, z: -6, type: 1 }], colliders: [wall] }));
  const old = FSimulation.create(fixture({ enemies: [{ x: 0, z: -6, type: 1 }], colliders: [wall] }));
  modern.move(modern.state.enemies[0], 2, 0, .38); old.move(old.state.enemies[0], 2, 0, .38);
  assert.equal(modern.state.enemies[0].x, old.state.enemies[0].x);
  assert.equal(modern.state.enemies[0].maxHp, old.state.enemies[0].maxHp);
});

test('Advanced heavy rifle and both Custodian cannons emit at their actual nominal mouths; cover stops an offset barrel', () => {
  for (const type of [1, 3]) {
    const pivot = type === 1 ? 1.33 : 2.28, y = type === 1 ? 1.375 : 2.28, forward = type === 1 ? 1.295 : 1.486;
    function committed(colliders = []) {
      const sim = FSimulation.create(fixture({ generation: 5, enemies: [{ x: 0, z: -2, type }], colliders }));
      Object.assign(sim.state.enemies[0], { yaw: 0, windup: .000001, windupMax: .8, attackState: 'aim', aimX: 0, aimY: pivot, aimZ: -20, cooldown: 30 });
      sim.step(.000001); return sim;
    }
    const clear = committed(); assert(events(clear, 'enemyShot').length > 0);
    for (const b of clear.state.bullets) {
      assert(Math.abs(b.y - y) < .00001); assert(Math.abs(b.z + 2 + forward) < .00001);
      assert(Math.abs(Math.abs(b.x) - (type === 1 ? .23 : 1.04)) < .00001, 'Projectile came from a phantom central barrel');
    }
    if (type === 3) {
      assert(clear.state.bullets.some(b => b.x < -1)); assert(clear.state.bullets.some(b => b.x > 1));
      assert.equal(clear.state.bullets.length, 5);
    }
    const blocked = committed([{ minX: -3, maxX: 3, minZ: -2.4, maxZ: -2.3, minY: pivot - .1, maxY: pivot + .3 }]);
    assert(blocked.state.bullets.length > 0);
    for (const b of blocked.state.bullets) assert(b.z > -2.3, 'Projectile appeared beyond a wall crossed by the body-to-mouth segment');
    advance(blocked, .2); assert.equal(blocked.state.bullets.length, 0); assert.equal(blocked.state.player.hp, 100);
  }
  const corner = FSimulation.create(fixture({ generation: 5, enemies: [{ x: 0, z: -2, type: 3 }],
    colliders: [{ minX: .7, maxX: 1.2, minZ: -3.4, maxZ: -3, minY: 2, maxY: 2.6 }],
  }));
  Object.assign(corner.state.enemies[0], { yaw: 0, windup: .000001, windupMax: .8, attackState: 'aim', aimX: 0, aimY: 2.28, aimZ: -20, cooldown: 30 });
  corner.step(.000001); assert(corner.state.bullets.some(b => b.x > 0 && b.z > -3));
  advance(corner, .2);
  assert(corner.state.bullets.length > 0 && corner.state.bullets.every(b => b.x < 0), 'An obstructed right barrel bent around its cover edge instead of hitting it');
});

test('An exposed visor sees over chest-high cover while a blocked rifle waits; an ally helmet also blocks the firing lane', () => {
  const covered = FSimulation.create(fixture({ generation: 5, enemies: [{ x: 0, z: -2, type: 1 }],
    colliders: [{ minX: -3, maxX: 3, minZ: -1.2, maxZ: -1.1, minY: 0, maxY: 1.6 }],
  }));
  const heavy = covered.state.enemies[0]; heavy.cooldown = 0; covered.step(.025);
  assert.equal(heavy.seen, true, 'Visible visor remained blind because perception used the old belly centre');
  assert.notEqual(heavy.attackState, 'aim', 'A rifle aimed through a cover edge below its exposed visor');
  assert.equal(covered.state.bullets.length, 0);
  const lane = FSimulation.create(fixture({ generation: 5, enemies: [{ x: 0, z: -12, type: 3 }, { x: -.8, z: -8, type: 1 }, { x: .8, z: -8, type: 1 }] }));
  lane.state.enemies[0].cooldown = 0; lane.state.enemies[1].cooldown = lane.state.enemies[2].cooldown = 30; lane.step(.025);
  assert.notEqual(lane.state.enemies[0].attackState, 'aim', 'The new higher barrel ignored the helmet of a squad mate');
});

test('Barrel-aligned heavy and Custodian attacks can still hit an upper terrace', () => {
  for (const type of [1, 3]) {
    const sim = FSimulation.create(reliefFixture({ spawn: { x: 12, y: 3.2, z: 0, yaw: 0 }, enemies: [{ x: -6, y: 0, z: 0, type }] }));
    sim.state.enemies[0].cooldown = 0; sim.step(.025); assert.equal(sim.state.enemies[0].seen, true);
    advance(sim, 1.2); assert(sim.state.bullets.some(b => b.dy > .5));
    advance(sim, 3.4); assert(sim.state.player.hp < 100, 'Aligned projectiles missed the elevated player');
  }
});

function padFixture(extra = {}) {
  return fixture({ generation: 5, bounds: { minX: -8, maxX: 22, minZ: -8, maxZ: 8 },
    spawn: { x: -3, y: 0, z: 0, yaw: Math.PI / 2 },
    walkable: [{ x: -2, z: 0, w: 8, d: 12, y: 0 }, { x: 14, z: 0, w: 12, d: 12, y: 3.2 }],
    jumpPads: [{ id: 'pad', x: 0, y: 0, z: 0, r: 1.15, target: { x: 12, y: 3.2, z: 0 }, flightTime: 1.5 }],
    cores: [{ id: 0, x: 10, y: 3.2, z: 5 }, { id: 1, x: 14, y: 3.2, z: 5 }, { id: 2, x: 18, y: 3.2, z: 5 }], exit: { x: 20, y: 3.2, z: 5 }, ...extra,
  });
}
function enterPad(sim) {
  for (let frame = 0; frame < 180 && !sim.state.player.airborne; frame++) sim.step(1 / 60, { moveY: 1 });
  assert.equal(sim.state.player.airborne, true, 'Walking onto the pad did not launch the player');
  return sim.state.player;
}

test('Walking into a jump pad launches a continuous ballistic arc from the actual entry point and lands on its upper terrace', () => {
  const sim = FSimulation.create(padFixture()), p = enterPad(sim), start = { x: p.x, y: p.y, z: p.z, vx: p.airVX, vy: p.airVY, vz: p.airVZ };
  assert(p.x < -.9 && p.x > -1.16, 'Launch snapped to the pad centre');
  assert.equal(events(sim, 'jumpPad').length, 1); assert.equal(events(sim, 'jumpPad')[0].actor, 'player');
  let peak = p.y, previous = p.x;
  for (let frame = 0; frame < 200 && p.airborne; frame++) {
    sim.step(1 / 60); peak = Math.max(peak, p.y);
    assert(p.x - previous < .2, 'The trajectory teleported horizontally'); previous = p.x;
    if (p.airborne) {
      assert(Math.abs(p.y - (start.y + start.vy * p.airTime - 6 * p.airTime ** 2)) < 1e-8);
      assert(Math.abs(p.x - (start.x + start.vx * p.airTime)) < 1e-8);
    }
  }
  assert(peak > 5 && peak < 5.3); assert.equal(p.airborne, false); assert.equal(p.y, 3.2);
  assert(Math.hypot(p.x - 12, p.z) < .15); assert.equal(events(sim, 'land').length, 1);
  assert.equal(p.hp, 100); assert.equal(sim.state.locomotion.moveBlend, 0, 'Flight produced walking animation');
});

test('Jump-pad trajectories agree at 20–120 Hz and modest air steering changes the physical landing', () => {
  const points = [];
  for (const fps of [20, 30, 60, 120]) {
    const sim = FSimulation.create(padFixture({ spawn: { x: 0, y: 0, z: 0, yaw: Math.PI / 2 } }));
    sim.step(0); advanceAt(sim, .7, fps); points.push([sim.state.player.x, sim.state.player.y]);
    advanceAt(sim, 1.3, fps); assert.equal(sim.state.player.airborne, false); assert.equal(sim.state.player.y, 3.2);
    assert(Math.abs(sim.state.player.x - 12) < .12);
  }
  for (const [x, y] of points) assert(Math.hypot(x - points[0][0], y - points[0][1]) < 1e-7);
  const steering = FSimulation.create(padFixture({ spawn: { x: 0, y: 0, z: 0, yaw: 0 } }));
  steering.step(0); for (let frame = 0; frame < 100 && steering.state.player.airborne; frame++) steering.step(.025, { moveX: 1 });
  assert(steering.state.player.x > 12.7 && steering.state.player.x < 14.5, 'Air control had no measurable bounded effect');
  assert.equal(steering.state.player.y, 3.2); assert.equal(steering.state.player.airborne, false);
});

test('A pad flight hits a thin wall and cannot cross a ceiling or a raised elevator deck', () => {
  const ground = [{ x: 6, z: 0, w: 28, d: 12, y: 0 }, { x: 14, z: 0, w: 12, d: 12, y: 3.2 }];
  const wall = FSimulation.create(padFixture({ spawn: { x: 0, y: 0, z: 0, yaw: 0 }, walkable: ground,
    colliders: [{ minX: 4, maxX: 4.02, minZ: -5, maxZ: 5, minY: 0, maxY: 12 }],
  }));
  wall.step(0); for (let frame = 0; frame < 120; frame++) { wall.step(.025); assert(wall.state.player.x <= 3.72 + 1e-7, 'Airborne player tunneled through the thin wall'); }
  assert.equal(wall.state.player.y, 0); assert.equal(wall.state.player.airborne, false); assert.equal(wall.state.player.hp, 100);
  for (const elevator of [false, true]) {
    const sim = FSimulation.create(padFixture({ spawn: { x: 0, y: 0, z: 0, yaw: 0 }, walkable: ground,
      colliders: elevator ? [] : [{ minX: -2, maxX: 5, minZ: -3, maxZ: 3, minY: 3, maxY: 3.2 }],
      lifts: elevator ? [{ id: 'overhead', x: 1.5, z: 0, w: 7, d: 6, minY: 3.22, maxY: 3.22, speed: 1.6 }] : [],
    }));
    sim.step(0); let highest = 0;
    for (let frame = 0; frame < 100; frame++) { sim.step(.025); highest = Math.max(highest, sim.state.player.y); }
    assert(highest <= 1.2 + 1e-7, 'Head passed through the overhead body'); assert.equal(sim.state.player.y, 0);
  }
});

test('A stationary pad cannot bounce forever; leaving and returning deliberately rearms it', () => {
  const sim = FSimulation.create(padFixture({ spawn: { x: 0, y: 0, z: 0, yaw: 0 },
    walkable: [{ x: 0, z: 0, w: 40, d: 12, y: 0 }],
    jumpPads: [{ id: 'pad', x: 0, y: 0, z: 0, r: 1.15, target: { x: 0, y: 0, z: 0 }, flightTime: 1.4 }],
  }));
  advance(sim, 5); assert.equal(events(sim, 'jumpPad').length, 1); assert.equal(sim.state.player.airborne, false);
  sim.move(sim.state.player, 3, 0); sim.step(.025); assert.equal(sim.state.player.padId, null);
  sim.move(sim.state.player, -3, 0); sim.step(.025); assert.equal(events(sim, 'jumpPad').length, 2); assert.equal(sim.state.player.airborne, true);
});

test('Midair checkpoints preserve momentum and reject invalid aerial state atomically', () => {
  const world = padFixture(), sim = FSimulation.create(world); enterPad(sim); advance(sim, .55);
  const data = sim.snapshot(); assert.equal(data.physicsVersion, 1); assert.equal(data.state.player.airborne, true);
  const restored = FSimulation.create(world); assert.equal(restored.restore(data), true);
  assert.equal(JSON.stringify(restored.snapshot()), JSON.stringify(data));
  advance(sim, 1.2); advance(restored, 1.2); assert.equal(JSON.stringify(restored.snapshot()), JSON.stringify(sim.snapshot()));
  const current = JSON.stringify(restored.snapshot());
  for (const corrupt of [
    d => { d.state.player.airVX = Infinity; }, d => { d.state.player.airVY = 60; }, d => { d.state.player.airTime = 9; },
    d => { d.state.player.padId = 'unregistered'; }, d => { d.state.player.y = -4; }, d => { d.state.player.airborne = false; },
    d => { delete d.physicsVersion; },
  ]) {
    const invalid = JSON.parse(JSON.stringify(data)); corrupt(invalid);
    assert.equal(restored.restore(invalid), false); assert.equal(JSON.stringify(restored.snapshot()), current);
  }
});

test('A mobile sentinel chooses a useful pad, crosses the gap physically and lands without invented player knowledge', () => {
  const world = padFixture({ spawn: { x: 15, y: 3.2, z: 0, yaw: -Math.PI / 2 }, enemies: [{ x: -3, y: 0, z: 0, type: 2, role: 'suppressor' }] });
  const sim = FSimulation.create(world), bot = sim.state.enemies[0]; bot.cooldown = 30;
  let airborne = false, previous = bot.x;
  for (let frame = 0; frame < 240; frame++) {
    sim.step(.025); assert(Math.abs(bot.x - previous) < .5, 'Bot teleported to the other platform'); previous = bot.x;
    airborne ||= bot.airborne;
    if (airborne && !bot.airborne) break;
  }
  assert.equal(airborne, true); assert.equal(bot.baseY, 3.2); assert(Math.abs(bot.x - 12) < .2);
  assert.equal(events(sim, 'jumpPad').filter(e => e.actor === 'enemy').length, 1);
  assert.equal(events(sim, 'land').filter(e => e.actor === 'enemy').length, 1);
  assert(Math.abs(bot.y - bot.baseY - 1.6) < 1e-9);
});

test('New sentinels reposition their firing range while legacy turrets remain fixed', () => {
  const locations = [];
  for (const generation of [4, 5]) {
    const sim = FSimulation.create(fixture({ generation, enemies: [{ x: 0, z: -5, type: 2 }] })), e = sim.state.enemies[0];
    e.cooldown = 30; advance(sim, 1); locations.push(Math.hypot(e.x, e.z + 5));
    assert.equal(sim.blocked(e.x, e.z, .38), false);
  }
  assert.equal(locations[0], 0); assert(locations[1] > 1.4);
});

test('Combat dodge reacts after an observed incoming shot, has a readable delay, and survives a checkpoint', () => {
  const world = fixture({ generation: 5, enemies: [{ x: 0, z: -12, type: 0, role: 'suppressor' }] });
  const sim = FSimulation.create(world), e = sim.state.enemies[0]; e.cooldown = 30; sim.step(.025);
  sim.fire(); assert.equal(e.hp, 2, 'The response retroactively dodged the already-fired hitscan');
  assert(e.dodgeDelay >= .08); advance(sim, .05); assert(Math.abs(e.x) < .01, 'Bot reacted before its visible delay');
  advance(sim, .12); const data = sim.snapshot(), restored = FSimulation.create(world); assert.equal(restored.restore(data), true);
  advance(sim, .35); advance(restored, .35);
  assert(Math.abs(e.x) > .65, 'The dodge label did not produce real movement');
  assert.equal(JSON.stringify(restored.snapshot()), JSON.stringify(sim.snapshot()));
  const hidden = FSimulation.create(fixture({ generation: 5, enemies: [{ x: 0, z: -8, type: 0 }],
    colliders: [{ minX: -3, maxX: 3, minZ: -5, maxZ: -4, minY: 0, maxY: 5 }],
  }));
  hidden.step(.025); hidden.fire(); assert.equal(hidden.state.enemies[0].dodgeTime, 0, 'A hidden bot reacted visually through an opaque wall');
});

test('Bots estimate vertical motion from visible flight instead of tracking future airborne coordinates', () => {
  const sim = FSimulation.create(padFixture({ spawn: { x: 0, y: 0, z: 0, yaw: 0 },
    bounds: { minX: -8, maxX: 22, minZ: -16, maxZ: 8 },
    walkable: [{ x: 6, z: -2, w: 28, d: 28, y: 0 }, { x: 14, z: 0, w: 12, d: 12, y: 3.2 }],
    enemies: [{ x: 0, y: 0, z: -12, type: 2 }],
  }));
  const e = sim.state.enemies[0]; e.cooldown = 30; sim.step(0); advance(sim, .4); e.cooldown = 0; sim.step(.025);
  assert(e.observedVY > 5); assert.equal(e.attackState, 'aim'); assert(e.aimY > e.lastSeenY + .5);
  const locked = [e.aimX, e.aimY, e.aimZ]; advance(sim, .2, { moveX: -1 }); assert.deepEqual([e.aimX, e.aimY, e.aimZ], locked);
});

function demolitionFixture(extra = {}) {
  const wall = { minX: -6, maxX: 6, minY: 0, maxY: 4, minZ: -8.09, maxZ: -7.91, mesh: 0 };
  return fixture({ generation: 5, meshes: [{ shape: 'box', p: [0, 2, -8], s: [12, 4, .18], r: [0, 0, 0], mat: 3 }],
    lights: [], walkable: [{ x: 0, y: 0, z: 0, w: 60, d: 60 }], colliders: [wall],
    destructibles: [{ id: 'wall', kind: 'wall', strength: 18, meshes: [0], colliders: [0] }], ...extra });
}

test('A real rocket opens a traversable wall breach, preserves cover for that blast, and updates AI routes and rays', () => {
  const world = demolitionFixture({ enemies: [{ x: 0, z: -10, type: 1 }] }), sim = FSimulation.create(world), enemy = sim.state.enemies[0];
  enemy.cooldown = 30; enemy.stun = .85;
  assert.equal(sim.blocked(0, -8), true); assert(sim.ray([0, 1.62, 0], [0, 0, -1], 20) < 8);
  sim.step(.01, { weapon: 2, fire: true });
  assert.equal(sim.state.projectiles[0].kind, 'rocket'); assert(sim.state.projectiles[0].z > -2, 'Projectile must physically start at the muzzle');
  advance(sim, .55);
  assert.equal(events(sim, 'explosion').length, 1); assert.equal(enemy.hp, 5, 'A wall must shield an enemy from the same blast which removes it');
  assert.equal(sim.blocked(0, -8), false); assert(sim.ray([0, 1.62, 0], [0, 0, -1], 20) > 19);
  assert(sim.destruction.meshes.length > 0, 'Surviving wall sides remain visible');
  assert(sim.blocked(5, -8), 'A local breach must not silently remove the whole wall');
  assert(sim.state.destructionRevision > 0);
  advance(sim, 3.7); assert(enemy.z > -7.5, 'The enemy must navigate through the new opening');
  sim.move(sim.state.player, 0, -10); assert(sim.state.player.z < -9.8, 'Player must physically cross the damaged wall');
  const restored = FSimulation.create(world); assert.equal(restored.restore(sim.snapshot()), true); assert.equal(restored.blocked(0, -8), false);
  assert.equal(JSON.stringify(restored.snapshot()), JSON.stringify(sim.snapshot()));
});

test('Repeated Impulse hits retain structural damage across checkpoints; Fracture can break a real prop', () => {
  const sim = FSimulation.create(demolitionFixture());
  sim.fire(); advance(sim, .3); sim.fire();
  const point = sim.snapshot(); assert(point.destruction.states.some(q => q.id === 'wall' && q.damage > 0));
  const resumed = FSimulation.create(demolitionFixture()); assert.equal(resumed.restore(point), true); assert.equal(JSON.stringify(resumed.snapshot()), JSON.stringify(point));
  for (let i = 0; i < 8; i++) { advance(resumed, .8); resumed.fire(); }
  assert(resumed.state.destructionRevision > 0, 'Repeated ordinary bullets must physically damage a wall');
  const crate = demolitionFixture({ colliders: [{ minX: -.7, maxX: .7, minY: 0, maxY: 2, minZ: -3.4, maxZ: -2.6, mesh: 0 }],
    meshes: [{ shape: 'box', p: [0, 1, -3], s: [1.4, 2, .8], r: [0, 0, 0], mat: 1 }], destructibles: [{ id: 'crate', kind: 'prop', strength: 6, meshes: [0], colliders: [0] }] });
  const shotgun = FSimulation.create(crate); shotgun.step(.01, { weapon: 1, fire: true });
  assert(shotgun.destruction.colliders.reduce((n, q) => n + (q.maxX - q.minX) * (q.maxY - q.minY) * (q.maxZ - q.minZ), 0) < 2.24, 'Fracture must remove solid material');
});

test('A muzzle blocked by a nearby wall produces a visible unarmed dud and never spawns a rocket behind the wall', () => {
  const world = demolitionFixture({ colliders: [{ minX: -5, maxX: 5, minY: 0, maxY: 4, minZ: -.7, maxZ: -.65, mesh: 0 }],
    meshes: [{ shape: 'box', p: [0, 2, -.675], s: [10, 4, .05], r: [0, 0, 0], mat: 3 }] }), sim = FSimulation.create(world);
  sim.step(.01, { weapon: 2, fire: true }); advance(sim, .15);
  assert.equal(sim.state.projectiles.length, 0); assert.equal(events(sim, 'rocketDud').length, 1); assert.equal(events(sim, 'explosion').length, 0);
  assert.equal(sim.state.player.hp, 100); assert(events(sim, 'rocketDud')[0].z > -.65);
});

test('An armed rocket self-blast is bounded; opaque cover prevents damage even while scenery breaks', () => {
  const world = demolitionFixture({ colliders: [{ minX: -5, maxX: 5, minY: 0, maxY: 4, minZ: -4.1, maxZ: -4, mesh: 0 }],
    meshes: [{ shape: 'box', p: [0, 2, -4.05], s: [10, 4, .1], r: [0, 0, 0], mat: 3 }] });
  const sim = FSimulation.create(world); sim.step(.01, { weapon: 2, fire: true }); advance(sim, .4);
  assert.equal(events(sim, 'explosion').length, 1); assert(sim.state.player.hp < 100); assert(sim.state.player.hp >= 68);
});

test('A destroyed gate really opens while a broken required control remains usable for progression and restore', () => {
  const sim = FSimulation.create(demolitionFixture({ colliders: [{minX:9.65,maxX:10.35,minY:0,maxY:1.6,minZ:-7.3,maxZ:-6.7,mesh:0}], meshes: [{shape:'box',p:[10,.8,-7],s:[.7,1.6,.6],r:[0,0,0],mat:1}], destructibles: [{id:'control-case',kind:'prop',strength:6,meshes:[0],colliders:[0]}],
    mechanisms: [{ id: 'control', x: 10, y: 0, z: -7, kind: 'breaker', name: 'Alimentation', required: true }],
    doors: [{ id: 'gate', x: 0, y: 0, z: -7, w: 4, d: .3, h: 3, requires: 'control' }] }));
  sim.step(.01, { weapon: 2, fire: true }); advance(sim, .5);
  assert.equal(sim.state.doors[0].destroyed, true); assert.equal(sim.state.mechanisms[0].active, false); assert.equal(sim.blocked(0, -7), false);
  assert.equal(FSimulation.create(sim.state.world).restore(sim.snapshot()), true, 'Broken locked doors must restore without faking their power source');
  sim.move(sim.state.player, 10, 0); aimAt(sim, 10, .95, -7); advance(sim, 2); sim.fire(); advance(sim, .5);
  assert.equal(sim.state.mechanisms[0].destroyed, true); assert.equal(sim.state.mechanisms[0].active, true);
  assert.equal(FSimulation.create(sim.state.world).restore(sim.snapshot()), true);
});

test('A grenadier announces a real ballistic throw, keeps its committed aim and gives enough time to leave the blast', () => {
  const world = fixture({ generation: 5, enemies: [{ x: 0, z: -15, type: 1, weapon: 'grenade' }] }), sim = FSimulation.create(world), e = sim.state.enemies[0];
  e.cooldown = 0; sim.step(.025); assert.equal(e.attackState, 'aim'); assert.equal(e.windupMax, 1.15);
  advance(sim, .8); assert.equal(sim.state.projectiles.length, 0, 'Throw must have a visible windup');
  advance(sim, .4); const q = sim.state.projectiles[0]; assert(q && q.kind === 'grenade'); assert(q.vy > 0); const vx = q.vx, vz = q.vz;
  sim.move(sim.state.player, 7, 0); advance(sim, .35);
  assert(Math.abs(q.vx - vx) < 1e-9 && Math.abs(q.vz - vz) < 1e-9, 'Grenade must not home toward the newly moved player');
  advance(sim, 2); assert(events(sim, 'explosion').length >= 1); assert.equal(sim.state.player.hp, 100, 'Announced blast must be escapable');
});

test('A rocketeer refuses an ally inside the blast area, then launches once the ally leaves', () => {
  const sim = FSimulation.create(fixture({ generation: 5, enemies: [{ x: 0, z: -15, type: 1, weapon: 'rocket' }, { x: 1.2, z: -1.5, type: 0 }] }));
  const [e, ally] = sim.state.enemies; e.cooldown = 0; ally.cooldown = 30;
  for (let i = 0; i < 70; i++) { ally.stun = .85; sim.step(.025); }
  assert.equal(events(sim, 'rocket').length, 0, 'A visible player is not permission to blast a nearby ally');
  sim.move(ally, 10, 0, .38); e.cooldown = 0;
  for (let i = 0; i < 160 && !events(sim, 'rocket').length; i++) { ally.stun = .85; sim.step(.025); }
  assert(events(sim, 'rocket').some(q => q.owner === e.id));
});

test('Grenade trajectories respect a low ceiling even when the bot repositions for a lower arc', () => {
  const sim = FSimulation.create(fixture({ generation: 5, enemies: [{ x: 0, z: -15, type: 1, weapon: 'grenade' }],
    colliders: [{ minX: -25, maxX: 25, minZ: -25, maxZ: 25, minY: 2.4, maxY: 2.6 }] }));
  sim.state.enemies[0].cooldown = 0; advance(sim, .8);assert.equal(events(sim, 'grenade').length, 0, 'The initial obstructed throw must be refused');
  for(let i=0;i<130;i++){sim.step(.025);for(const q of sim.state.projectiles)assert(q.y+q.radius<=2.4+1e-6,'A grenade crossed the actual ceiling');}
});

function pipeFixture(extra = {}) {
  return fixture({ generation: 5, spawn: { x: 0, z: 0, yaw: 0 }, colliders: [{ minX: -.3, maxX: .3, minY: 0, maxY: 1.6, minZ: -2.3, maxZ: -1.7, mesh: 0 }],
    meshes: [{ shape: 'box', p: [0, .8, -2], s: [.6, 1.6, .6], r: [0, 0, 0], mat: 1 }, { shape: 'box', p: [0, 1, -1.72], s: [.24, .24, .36], r: [0, 0, 0], mat: 1 }],
    destructibles: [{ id: 'pipe', kind: 'pipe', strength: 3, meshes: [0, 1], colliders: [0] }],
    pipes: [{ id: 'hot', destructibleId: 'pipe', x: 0, y: 1, z: -2, dx: 0, dy: 0, dz: 1, length: 3, radius: .45, delay: 1, duration: 3, damage: 8, period: 0 }], ...extra });
}

test('A punctured pipe warns before hot gas, hurts at its actual nozzle and can be escaped or blocked by cover', () => {
  const stay = FSimulation.create(pipeFixture()); aimAt(stay, 0, 1, -2); stay.fire();
  assert.equal(stay.state.pipes[0].active, true); assert.equal(stay.state.pipes[0].warning, true); assert.equal(stay.state.player.hp, 100);
  advance(stay, .8); assert.equal(stay.state.player.hp, 100); advance(stay, .5); assert(stay.state.player.hp < 100);
  const flee = FSimulation.create(pipeFixture()); aimAt(flee, 0, 1, -2); flee.fire(); advance(flee, .8, { moveX: 1 }); advance(flee, 1);
  assert.equal(flee.state.player.hp, 100);
  const shield = pipeFixture(); shield.colliders.push({ minX: -5, maxX: 5, minY: 0, maxY: 3, minZ: -1, maxZ: -.9 });
  const protectedSim = FSimulation.create(shield); const q = protectedSim.state.pipes[0]; q.active = true; q.remaining = 4;
  advance(protectedSim, 2); assert.equal(protectedSim.state.player.hp, 100, 'Gas and its initial blast cannot pass through opaque cover');
});

test('A pressure plate announces spikes and allows retreat; a press stops at the body instead of clipping through it', () => {
  const spikeWorld = fixture({ generation: 5, traps: [{ id: 'spikes', kind: 'spikes', x: 0, y: 0, z: 0, w: 1.6, d: 1.6, h: 1.1, active: 1.8, warning: 1.2, damage: 18 }] });
  const stay = FSimulation.create(spikeWorld); advance(stay, .8); assert.equal(stay.state.player.hp, 100); assert.equal(stay.state.traps[0].warning, true);
  advance(stay, 1); assert(stay.state.player.hp < 100);
  const flee = FSimulation.create(spikeWorld); advance(flee, .7, { moveX: 1 }); advance(flee, 1.5); assert.equal(flee.state.player.hp, 100);
  const press = FSimulation.create(fixture({ generation: 5, traps: [{ id: 'press', kind: 'press', x: 0, y: 0, z: 0, w: 1.6, d: 1.6, h: .65, travel: 2.6, active: 2, warning: 1.2, period: 7, phase: 0, damage: 24 }] }));
  for (let i = 0; i < 35; i++) { press.step(.025); assert(press.state.traps[0].box.minY >= press.state.player.y + 1.8 - 1e-8, 'Moving press penetrated the player body'); }
  assert(press.state.player.hp < 100); assert.equal(press.blocked(0, 0), false, 'Contact must leave room to escape sideways');
  assert.equal(FSimulation.create(press.state.world).restore(press.snapshot()), true);
});

test('A moving blade stops at physical contact and restores its actual stopped pose', () => {
  const world = fixture({ generation: 5, spawn: { x: 0, z: 0, yaw: 0 }, traps: [{ id: 'blade', kind: 'blade', x: 0, y: .8, z: 0, w: .3, d: 1.35, h: .3, axis: 'x', travel: 1.65, period: 7, active: 2, warning: 1.2, phase: 0, damage: 18 }] });
  const sim = FSimulation.create(world);
  for (let i = 0; i < 35; i++) { sim.step(.025); const q = sim.state.traps[0].box; assert(q.maxX <= sim.state.player.x - .28 + 1e-7, 'Blade must not translate inside the player'); }
  assert(sim.state.player.hp < 100); assert.equal(FSimulation.create(world).restore(sim.snapshot()), true);
});

test('Destruction checkpoints retain flying explosives and leaking machinery; corrupted changes fail atomically', () => {
  const world = demolitionFixture({ pipes: [{ id: 'leak', x: 10, y: 1, z: 0, dx: 1, dy: 0, dz: 0, delay: 1, duration: 3, damage: 8 }] });
  const sim = FSimulation.create(world); sim.step(.01, { weapon: 2, fire: true }); advance(sim, .1);
  const point = sim.snapshot(); assert.equal(point.destructionVersion, 1); assert.equal(point.state.projectiles.length, 1);
  const resumed = FSimulation.create(world); assert.equal(resumed.restore(point), true); assert.equal(JSON.stringify(resumed.snapshot()), JSON.stringify(point));
  advance(sim, .7); advance(resumed, .7); assert.equal(JSON.stringify(resumed.snapshot()), JSON.stringify(sim.snapshot()));
  const original = JSON.stringify(resumed.snapshot());
  for (const corrupt of [
    q => { q.state.projectiles[0].vx = Infinity; }, q => { q.state.projectiles[0].radius = 4; }, q => { q.state.projectiles[0].owner = 999; },
    q => { q.state.pipes[0].age = -1; }, q => { q.destruction.signature = 'wrong'; }, q => { q.destruction.states.push({ id: 'invented', damage: 0, cuts: [], removed: true }); },
  ]) { const bad = JSON.parse(JSON.stringify(point)); corrupt(bad); assert.equal(resumed.restore(bad), false); assert.equal(JSON.stringify(resumed.snapshot()), original); }
});

test('Fallback outdoor substrate never overrides a higher ramp or terrace', () => {
  const sim = FSimulation.create(fixture({ generation: 5, walkable: [
    { x: 0, z: 0, w: 4, d: 4, y: 0 }, { x: 0, z: -7, w: 4, d: 10, y: 1.6, slopeZ: -.32 },
    { x: 0, z: -14, w: 4, d: 4, y: 3.2 }, { x: 0, z: 0, w: 60, d: 60, y: -.25, substrate: true, fallback: true },
  ] }));
  assert.equal(sim.ground(8, 0), -.25); assert.equal(sim.ground(0, 0), 0); assert.equal(sim.ground(0, -7), 1.6); assert.equal(sim.ground(0, -14), 3.2);
  walkTo(sim, { x: 0, z: -14 }); assert(Math.abs(sim.state.player.y - 3.2) < 1e-8);
});

function giantFixture(kind = 'colossus', extra = {}) {
  const stage = ['colossus', 'siegebreaker', 'custodian'].indexOf(kind), size = [5.4, 7.2, 9][stage];
  const boss = { x: 0, y: 0, z: -25, type: 3, bossScale: size, bossKind: kind, bossName: kind, maxHp: [130, 180, 240][stage], arena: { x: 0, z: -25, r: 28 } };
  const waves = [1, 2].flatMap(wave => [0, 1, 2].map(n => ({ x: wave === 1 ? -24 : 24, y: 0, z: -28 + n * 3, type: 0, bossWave: wave, bossId: 0, squadId: wave })));
  return fixture({ generation: 5, stage, spawn: { x: 0, y: 0, z: 10, yaw: 0 }, bounds: { minX: -60, maxX: 60, minZ: -65, maxZ: 40 },
    walkable: [{ x: 0, y: 0, z: -12.5, w: 120, d: 105 }], enemies: [boss, ...waves], ...extra });
}
function corePoint(e) { return { x: e.x + Math.sin(e.yaw) * .9 * e.bossScale, y: e.baseY + 1.93 * e.bossScale, z: e.z - Math.cos(e.yaw) * .9 * e.bossScale }; }
function enterGiantArena(sim) { sim.move(sim.state.player, 0, -17); sim.step(.025); assert.equal(sim.state.enemies[0].bossAwake, true); }

test('Each giant has its real size and health, remains dormant outside the arena, and physically blocks passage', () => {
  for (const kind of ['colossus', 'siegebreaker', 'custodian']) {
    const sim = FSimulation.create(giantFixture(kind)), e = sim.state.enemies[0];
    advance(sim, 3); assert.equal(e.bossAwake, false); assert.equal(sim.state.bossAttacks.length, 0); assert.equal(sim.state.projectiles.length, 0);
    assert.equal(e.hp, sim.state.world.enemies[0].maxHp); assert(Math.abs(e.y - e.bossScale * 1.8) < 1e-8);
    enterGiantArena(sim); sim.move(sim.state.player, 0, -50);
    assert(Math.hypot(sim.state.player.x - e.x, sim.state.player.z - e.z) >= e.bossScale * 1.5 + .28 - 1e-7, 'Player crossed the giant body');
    assert.equal(sim.state.enemies.length, 7); assert(sim.state.enemies.slice(1).every(q => !q.bossReleased));
    assert.equal(FSimulation.create(sim.state.world).restore(sim.snapshot()), true);
  }
});

test('A giant slam announces the exact danger area, can be escaped, and exposes the visible core for stronger aimed damage', () => {
  const sim = FSimulation.create(giantFixture()), e = sim.state.enemies[0];
  let core = corePoint(e); aimAt(sim, core.x, core.y, core.z); sim.fire();
  assert(Math.abs(e.maxHp - e.hp - .30) < 1e-8, 'Closed armour must remain damageable'); assert.equal(e.bossAwake, false);
  advance(sim, .3); enterGiantArena(sim);
  for (let i = 0; i < 120 && !sim.state.bossAttacks.length; i++) sim.step(.025);
  const attack = sim.state.bossAttacks[0]; assert.equal(attack.kind, 'slam'); assert.equal(attack.warning, true);
  const hp = sim.state.player.hp; advance(sim, .5); assert.equal(sim.state.player.hp, hp, 'No damage during tell');
  sim.move(sim.state.player, 6, 0); advance(sim, 1.5); assert.equal(sim.state.player.hp, hp, 'The displayed circle must be escapable');
  assert.equal(e.weakPointOpen, true); assert(e.weakTimer > 0);
  core = corePoint(e); aimAt(sim, core.x, core.y, core.z); const before = e.hp; sim.fire();
  assert(Math.abs(before - e.hp - 3.2) < 1e-7, 'An accurate shot must hit the protruding core before the torso');
  assert.equal(FSimulation.create(sim.state.world).restore(sim.snapshot()), true);
});

test('Giant phases release only the six physically preplaced reinforcements, retain IDs, and clamp the entire silhouette to its arena', () => {
  const sim = FSimulation.create(giantFixture('custodian')), e = sim.state.enemies[0], ids = sim.state.enemies.map(q => q.id);
  enterGiantArena(sim); e.hp = e.maxHp * .66; sim.step(.025);
  assert.equal(e.phase, 1); assert(sim.state.enemies.filter(q => q.bossWave === 1).every(q => q.bossReleased)); assert(sim.state.enemies.filter(q => q.bossWave === 2).every(q => !q.bossReleased));
  e.hp = e.maxHp * .33; sim.step(.025); assert.equal(e.phase, 2); assert(sim.state.enemies.slice(1).every(q => q.bossReleased));
  assert.deepEqual(sim.state.enemies.map(q => q.id), ids); assert.equal(sim.state.enemies.length, 7);
  for (let i = 0; i < 180; i++) { sim.state.player.hp = 100; sim.step(.025); assert(Math.hypot(e.x - e.arena.x, e.z - e.arena.z) <= Math.max(1, e.arena.r - 2.1 * e.bossScale - 5) + 1e-7); }
  assert.equal(FSimulation.create(sim.state.world).restore(sim.snapshot()), true);
});

test('The three giant scripts produce distinct physical attacks and real cannon rockets instead of damage-only visual effects', () => {
  const expected = { colossus: ['slam', 'ring'], siegebreaker: ['rocketZone', 'sweep'], custodian: ['ring', 'rocketZone', 'sweep'] };
  for (const [kind, types] of Object.entries(expected)) {
    const sim = FSimulation.create(giantFixture(kind)); enterGiantArena(sim); const seen = new Set(); let rockets = 0;
    for (let i = 0; i < 1000; i++) {
      sim.state.player.hp = 100; sim.state.dead = false; sim.step(.025);
      for (const q of sim.state.bossAttacks) { seen.add(q.kind); assert(q.warning !== q.active); if (q.kind === 'ring') assert(q.innerRadius <= q.currentRadius && q.currentRadius <= q.radius); }
      rockets += events(sim, 'rocket').filter(q => q.owner === 0).length; sim.state.events = [];
    }
    for (const type of types) assert(seen.has(type), `${kind} did not execute ${type}`);
    if (kind !== 'colossus') assert(rockets >= 2, 'Barrage must launch actual swept projectiles');
    assert.equal(FSimulation.create(sim.state.world).restore(sim.snapshot()), true);
  }
});

test('Giant helmets, legs and exposed cores are targetable at their scaled positions while opaque walls still occlude them', () => {
  for (const size of [5.4, 9]) {
    const world = giantFixture(size === 9 ? 'custodian' : 'colossus'), sim = FSimulation.create(world), e = sim.state.enemies[0];
    const targets = [ { x: e.x, y: e.baseY + 2.89 * size, z: e.z }, { x: e.x + .86 * size, y: e.baseY + .7 * size, z: e.z + .68 * size } ];
    for (const target of targets) { aimAt(sim, target.x, target.y, target.z); const hp = e.hp; sim.fire(); assert(e.hp < hp, 'Visible scaled body part must be hittable'); advance(sim, .25); }
    const wall = { minX: -40, maxX: 40, minZ: -5.2, maxZ: -5, minY: 0, maxY: 40 };
    const shielded = FSimulation.create({ ...world, colliders: [wall] }), protectedBoss = shielded.state.enemies[0], core = corePoint(protectedBoss);
    aimAt(shielded, core.x, core.y, core.z); shielded.fire(); assert.equal(protectedBoss.hp, protectedBoss.maxHp);
  }
});

test('A giant encounter restores telegraphs, projectiles, phases and reserves exactly, rejects corrupted scripts and saves its real death', () => {
  const world = giantFixture('siegebreaker'), sim = FSimulation.create(world); enterGiantArena(sim);
  for (let i = 0; i < 160 && !sim.state.bossAttacks.length; i++) sim.step(.025);
  advance(sim, .4); const point = sim.snapshot(); assert.equal(point.bossVersion, 1); assert(point.state.bossAttacks.length > 0);
  const resumed = FSimulation.create(world); assert.equal(resumed.restore(point), true); assert.equal(JSON.stringify(resumed.snapshot()), JSON.stringify(point));
  for (let i = 0; i < 70; i++) { sim.step(.025); resumed.step(.025); } assert.equal(JSON.stringify(resumed.snapshot()), JSON.stringify(sim.snapshot()));
  const current = JSON.stringify(resumed.snapshot());
  for (const corrupt of [q => { q.state.bossAttacks[0].radius = 999; }, q => { q.state.bossAttacks[0].bossId = 1; }, q => { q.state.enemies[0].phase = 3; }, q => { q.state.enemies[0].weakTimer = Infinity; }, q => { q.state.enemies[0].x = 50; }]) {
    const bad = JSON.parse(JSON.stringify(point)); corrupt(bad); assert.equal(resumed.restore(bad), false); assert.equal(JSON.stringify(resumed.snapshot()), current);
  }
  const boss = sim.state.enemies[0]; boss.hp = .05; sim.state.player.hp = 100; sim.state.player.overheated = false; sim.state.player.heat = 0; advance(sim, .3);
  const core = corePoint(boss); aimAt(sim, core.x, core.y, core.z); sim.fire();
  assert.equal(boss.hp, 0); assert.equal(sim.state.bossAttacks.length, 0); assert.equal(events(sim, 'bossDeath').length, 1); assert(sim.state.explosions.some(q => q.kind === 'boss'));
  assert.equal(FSimulation.create(world).restore(sim.snapshot()), true, 'The bossDeath autosave must be immediately valid');
});

function horrorFixture(extra = {}) {
  return fixture({ generation: 5, director: { enabled: true }, horrorSites: [{ id: 'machine', x: 8, y: 0, z: 6, kind: 'collapse', radius: 3 }], ...extra });
}

test('The first-sector entry has ten real seconds of grace, then observable enemies resume normal announced attacks', () => {
  const sim = FSimulation.create(horrorFixture({ enemies: [{ x: 0, z: -8, type: 0 }] })); sim.state.enemies[0].cooldown = 0;
  advance(sim, 9.8); assert.equal(sim.state.player.hp, 100); assert.equal(events(sim, 'enemyShot').length, 0); assert(sim.state.director.grace > 0);
  advance(sim, 3); assert.equal(sim.state.director.grace, 0); assert(events(sim, 'enemyShot').length > 0); assert(sim.state.player.hp < 100);
  assert.equal(sim.state.enemies.length, 1, 'Pressure must never create hidden replacement enemies');
});

test('Difficulty changes real hostile cadence, projectile speed and damage while preserving enemy health and actor count', () => {
  const worlds = [0, 2].map(difficulty => {
    const sim = FSimulation.create(fixture({ generation: 5, enemies: [{ x: 0, z: -12, type: 0 }] }));
    assert.equal(sim.setDifficulty(difficulty), true); assert.equal(sim.setDifficulty(4), false); assert.equal(sim.state.difficulty, difficulty); sim.state.enemies[0].cooldown = 0;
    for (let i = 0; i < 100 && !events(sim, 'enemyShot').length; i++) sim.step(.025);
    const q = sim.state.bullets[0]; assert(q); const hp = sim.state.player.hp; sim.hurt(10);
    return { sim, speed: Math.hypot(q.dx, q.dy, q.dz), cooldown: sim.state.enemies[0].cooldown, damage: hp - sim.state.player.hp };
  });
  assert(worlds[1].speed > worlds[0].speed); assert(worlds[1].cooldown < worlds[0].cooldown); assert(worlds[1].damage > worlds[0].damage);
  for (const { sim } of worlds) { assert.equal(sim.state.enemies[0].maxHp, 3); assert.equal(sim.state.enemies.length, 1); assert.equal(FSimulation.create(sim.state.world).restore(sim.snapshot()), true); }
});

test('Horror events use fixed physical sites; an ambush follows the audible site without discovering a hidden player', () => {
  const world = horrorFixture({ enemies: [{ x: 12, z: 6, type: 0 }], colliders: [{ minX: 4.8, maxX: 5.2, minY: 0, maxY: 5, minZ: -30, maxZ: 30 }] });
  let found = false;
  for (let sequence = 0; sequence < 12 && !found; sequence++) {
    const sim = FSimulation.create(world); sim.state.director.events = sequence; sim.state.director.nextEvent = 0; sim.step(.025);
    const event = events(sim, 'horror')[0]; assert(event); assert.deepEqual([event.x, event.y, event.z], [8, .8, 6]);
    if (event.kind !== 'ambush') continue;
    const e = sim.state.enemies[0]; assert.equal(e.seen, false); assert.equal(e.awareness, 'investigate'); assert.deepEqual([e.lastSeenX, e.lastSeenZ], [8, 6]); assert.notEqual(e.lastSeenX, sim.state.player.x);
    assert.equal(sim.state.enemies.length, 1); found = true;
  }
  assert(found, 'The deterministic event sequence must contain an ambush');
});

test('Director pressure, difficulty and event timing round-trip exactly and malformed horror saves fail atomically', () => {
  const world = horrorFixture({ stage: 2 }), sim = FSimulation.create(world); sim.setDifficulty(2); sim.state.director.nextEvent = 0; advance(sim, .4);
  const point = sim.snapshot(); assert.equal(point.directorVersion, 1); assert.equal(point.state.difficulty, 2); assert(point.state.director.eventType); assert(point.state.director.pressure > 0);
  const restored = FSimulation.create(world); assert.equal(restored.restore(point), true); assert.equal(JSON.stringify(restored.snapshot()), JSON.stringify(point));
  advance(sim, 3); advance(restored, 3); assert.equal(JSON.stringify(restored.snapshot()), JSON.stringify(sim.snapshot()));
  const current = JSON.stringify(restored.snapshot());
  for (const change of [q => { q.state.difficulty = 3; }, q => { q.state.director.pressure = NaN; }, q => { q.state.director.eventX = 999; }, q => { q.state.director.eventType = 'invented'; }, q => { q.state.director.grace = 99; }]) {
    const invalid = JSON.parse(JSON.stringify(point)); change(invalid); assert.equal(restored.restore(invalid), false); assert.equal(JSON.stringify(restored.snapshot()), current);
  }
});

test('A breach changes collision immediately while a large navigation grid is refreshed in bounded batches', () => {
  const world = demolitionFixture({ bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, walkable: [{ x: 0, z: 0, w: 200, d: 200, y: 0 }] });
  const sim = FSimulation.create(world); sim.step(.01, { weapon: 2, fire: true });
  let pending = false;
  for (let i = 0; i < 50; i++) { sim.step(.01); assert(sim.state.aiStats.navUpdates <= 768); pending ||= sim.state.aiStats.navPending > 0; }
  assert(pending, 'Large-grid maintenance must actually be amortised'); assert.equal(sim.blocked(0, -8), false);
  sim.move(sim.state.player, 0, -10); assert(sim.state.player.z < -9.8, 'Physical passage must not wait for the advisory navigation queue');
  const point = sim.snapshot(); assert.equal(FSimulation.create(world).restore(point), true);
  assert.equal(sim.nav.cells[sim.nav.idx(0, -8)], 1, 'A checkpoint must materialise the updated walking map');
});

test('Periodic pipe bursts spare their physical source, but external destruction ends future autonomous bursts', () => {
  const world = pipeFixture(); Object.assign(world.pipes[0], { period: 5, phase: 0, delay: 1, duration: 1 });
  const sim = FSimulation.create(world); sim.move(sim.state.player, 5, 0); advance(sim, 11.2);
  assert(events(sim, 'explosion').length >= 2); assert.equal(sim.destruction.isAlive('pipe'), true); assert.equal(sim.state.pipes[0].broken, false);
  sim.move(sim.state.player, -5, 0); aimAt(sim, 0, 1, -2); sim.fire(); advance(sim, .3); sim.fire();
  assert.equal(sim.destruction.isAlive('pipe'), false); assert.equal(sim.state.pipes[0].broken, true);
  sim.move(sim.state.player, 5, 0); advance(sim, 3); const count = events(sim, 'explosion').length; advance(sim, 7);
  assert.equal(events(sim, 'explosion').length, count, 'A destroyed pipe cannot keep exploding from an invisible source');
  assert.equal(FSimulation.create(world).restore(sim.snapshot()), true);
});

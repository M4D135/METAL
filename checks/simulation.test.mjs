import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const context = { window: {} };
vm.createContext(context);
for (const name of ['world', 'simulation']) {
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
  const start = idx(sim.state.player.x, sim.state.player.z), end = idx(target.x, target.z);
  assert(cells[start], 'Start does not map to navigable ground');
  assert(cells[end], 'Objective does not map to navigable ground');
  const parent = new Int32Array(cells.length).fill(-1), queue = [start];
  parent[start] = start;
  for (let head = 0; head < queue.length && parent[end] < 0; head++) {
    const at = queue[head], x = at % nx, z = Math.floor(at / nx);
    for (const next of [x ? at - 1 : -1, x < nx - 1 ? at + 1 : -1, z ? at - nx : -1, z < nz - 1 ? at + nx : -1]) {
      if (next >= 0 && cells[next] && parent[next] < 0) { parent[next] = at; queue.push(next); }
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
  const keys = ['awareness', 'tactic', 'hasMemory', 'lastSeenX', 'lastSeenZ', 'memory', 'alert', 'seen', 'senseWait', 'thinkWait', 'shareWait', 'alertWait', 'coverWait', 'holdTime', 'planWait', 'patrolIndex', 'searchIndex', 'goalX', 'goalZ', 'pathAt', 'stuck', 'moveSpeed', 'path'];
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
  const enemy = sim.state.enemies[2]; Object.assign(sim.state.player, { x: 14, z: 16 });
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

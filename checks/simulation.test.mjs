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

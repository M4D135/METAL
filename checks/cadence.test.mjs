import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Fixed cadence and zero-step input retention are exercised through the real shell
// in checkpoint.test.mjs; long display clocks are covered by floop.test.mjs.
test('A 17.7 ms simulation step still stops sprint and dash at a thin wall', () => {
  const context = vm.createContext({window: {}});
  for (const name of ['fmath', 'passages', 'renderer', 'world', 'destruction', 'economy', 'simulation']) {
    vm.runInContext(readFileSync(new URL('../src/' + name + '.js', import.meta.url), 'utf8'), context, {filename: name + '.js'});
  }
  const sim = context.window.FSimulation.create({
    seed: 'cadence-wall', stage: 0, spawn: {x: 0, z: -.4, yaw: 0},
    bounds: {minX: -30, maxX: 30, minZ: -30, maxZ: 30},
    colliders: [{minX: -20, maxX: 20, minZ: -1.02, maxZ: -1, minY: 0, maxY: 4}],
    enemies: [], pickups: [], cores: [{id: 0, x: 15, z: 15}, {id: 1, x: 18, z: 15}, {id: 2, x: 21, z: 15}],
    exit: {x: 24, z: 15},
  });
  for (let step = 0; step < 240; step++) {
    sim.step(.0177, {moveY: 1, sprint: true, dash: step % 60 === 0});
    assert(sim.state.player.z >= -.72 - 1e-8, 'Player crossed the thin wall');
    assert.equal(sim.blocked(sim.state.player.x, sim.state.player.z), false);
  }
  assert(sim.state.elapsed > 4, 'The margin check must advance actual gameplay');
});

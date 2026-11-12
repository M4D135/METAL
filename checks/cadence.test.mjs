import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Exercise the expression actually used by frame(), not a duplicate implementation.
const game = readFileSync(new URL('../src/game.js', import.meta.url), 'utf8');
const match = game.match(/const steps=([^\n]+?),part=dt\/steps;/);
assert(match, 'The game frame subdivision expression must be identifiable');
const stepsFor = vm.runInNewContext('(dt)=>(' + match[1] + ')');

test('Timestamp precision and 59.94 Hz do not add a simulation substep', () => {
  for (const milliseconds of [16.6, 16.7, 16.683, 17]) {
    assert.equal(stepsFor(milliseconds / 1000), 1, milliseconds + ' ms');
  }
  assert.equal(stepsFor(33.4 / 1000), 2);
});

test('Rounded 60 Hz clocks remain at one step across the former long-session boundary', () => {
  for (const origin of [0, 1e6]) for (const quantum of [.1, 1]) {
    let last = origin;
    for (let frame = 1; frame <= 36000; frame++) {
      const now = Math.round((origin + frame * 1000 / 60) / quantum) * quantum;
      assert.equal(stepsFor((now - last) / 1000), 1, `origin=${origin} quantum=${quantum} frame=${frame}`);
      last = now;
    }
  }
});

test('Native refresh clocks preserve the intended subdivision at 30 through 240 Hz', () => {
  for (const hz of [30, 59.94, 60, 75, 90, 120, 144, 165, 240]) {
    let last = 0;
    for (let frame = 1; frame <= Math.ceil(15 * hz); frame++) {
      const now = frame * 1000 / hz;
      assert.equal(stepsFor((now - last) / 1000), hz === 30 ? 2 : 1, hz + ' Hz');
      last = now;
    }
  }
});

test('Every permitted frame delta retains a bounded step and all elapsed time', () => {
  for (let microseconds = 0; microseconds <= 120000; microseconds++) {
    const dt = microseconds / 1e6, count = stepsFor(dt), part = dt / count;
    assert(Number.isInteger(count) && count >= 1);
    assert(part <= .0177, 'collision integration interval exceeded 17.7 ms');
    assert(Math.abs(part * count - dt) <= Number.EPSILON);
  }
});

test('A 17.7 ms simulation step still stops sprint and dash at a thin wall', () => {
  const context = vm.createContext({window: {}});
  for (const name of ['renderer', 'world', 'destruction', 'economy', 'simulation']) {
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

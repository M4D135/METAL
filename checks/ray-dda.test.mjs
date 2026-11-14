// LOT 02 T8 (SIM-07) — non-régression du broad-phase DDA des rayons.
// Le DDA (rayCells/rayVisit) remplace le balayage complet de `solids` dans ray().
// Ces cas posent des murs dans des seaux de 8 m différents (traversée de plusieurs
// cellules), derrière l'origine (aucun impact) et une origine hors grille (repli sur
// le balayage complet). Les distances attendues sont calculées à la main sur l'AABB.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const context = { window: {} };
vm.createContext(context);
for (const name of ['fmath', 'passages', 'renderer', 'world', 'destruction', 'economy', 'simulation']) {
  vm.runInContext(readFileSync(`${root}src/${name}.js`, 'utf8'), context, { filename: `${name}.js` });
}
const { FSimulation } = context.window;

function fixture(extra = {}) {
  return {
    seed: 'dda', stage: 0, spawn: { x: 0, z: 0, yaw: 0 },
    bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 },
    colliders: [], enemies: [], pickups: [],
    cores: [{ id: 0, x: 15, z: 15 }, { id: 1, x: 18, z: 15 }, { id: 2, x: 21, z: 15 }],
    exit: { x: 24, z: 15 }, ...extra,
  };
}
const wall = (x, z) => ({ minX: x, maxX: x + .08, minZ: z - 2, maxZ: z + 2, minY: 0, maxY: 4 });

test('DDA finds the nearest wall across several 8 m buckets', () => {
  const sim = FSimulation.create(fixture({ colliders: [wall(10, 0), wall(20, 0), wall(25, 0)] }));
  assert(Math.abs(sim.ray([0, 1.62, 0], [1, 0, 0], 75) - 10) < 1e-9, 'nearest wall, hits its minX face');
  assert(Math.abs(sim.ray([15, 1.62, 0], [1, 0, 0], 75) - 5) < 1e-9, 'wall two buckets ahead, distance from origin');
  assert(Math.abs(sim.ray([0, 1.62, 0], [1, 0, 0], 12) - 10) < 1e-9, 'far=12 still reaches the wall at 10');
  assert.equal(sim.ray([0, 1.62, 0], [1, 0, 0], 9), 9, 'far=9 stops before the wall at 10');
});

test('DDA walks a long run to a distant bucket', () => {
  const sim = FSimulation.create(fixture({ colliders: [wall(25, 0)] }));
  assert(Math.abs(sim.ray([0, 1.62, 0], [1, 0, 0], 75) - 25) < 1e-9, 'wall reached after crossing buckets');
});

test('DDA ignores a wall behind the origin', () => {
  const sim = FSimulation.create(fixture({ colliders: [wall(10, 0)] }));
  assert.equal(sim.ray([0, 1.62, 0], [-1, 0, 0], 75), 75, 'no hit behind the origin');
});

test('DDA misses a wall outside the ray corridor', () => {
  const sim = FSimulation.create(fixture({ colliders: [wall(10, 12)] }));
  assert.equal(sim.ray([0, 1.62, 0], [1, 0, 0], 75), 75, 'wall off-axis in z is not hit');
});

test('Downward ray reaches the ground plane when there is no floor', () => {
  const sim = FSimulation.create(fixture({ colliders: [] }));
  assert(Math.abs(sim.ray([3, 1.62, 4], [0, -1, 0], 75) - 1.62) < 1e-9, 'floor hit at y=0');
});

test('Origin outside the bucket grid falls back to the full scan', () => {
  const sim = FSimulation.create(fixture({ colliders: [wall(10, 0)] }));
  // From x=100 toward -x the ray meets the wall maxX face (10.08): distance 89.92.
  assert(Math.abs(sim.ray([100, 1.62, 0], [-1, 0, 0], 200) - 89.92) < 1e-9, 'out-of-grid origin still hits the wall');
});

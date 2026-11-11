// Independent physical reachability checks. No WebGL, browser or dependencies.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const source = fileURLToPath(new URL('../src/world.js', import.meta.url));
const sandbox = { window: {} };
vm.runInNewContext(readFileSync(source, 'utf8'), sandbox, { filename: source });
const { create } = sandbox.window.FWorld;
const seeds = [1, 7, 42, 96, 2026, 65535];
const radius = .28, spacing = .25;

function finiteNumbers(value, path = 'world') {
  if (typeof value === 'number') assert(Number.isFinite(value), `${path} is not finite`);
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) finiteNumbers(child, `${path}.${key}`);
  }
}

function reachability(world, label) {
  const bounds = world.bounds;
  const width = Math.ceil((bounds.maxX - bounds.minX) / spacing);
  const depth = Math.ceil((bounds.maxZ - bounds.minZ) / spacing);
  assert(width > 0 && depth > 0 && width * depth < 1000000, `${label}: unreasonable bounds`);
  const floors = [...world.rooms, ...(world.corridors || [])];
  assert(floors.length, `${label}: no walkable floor areas`);
  const obstacles = world.colliders.filter(box => box.minY <= 1.8 && box.maxY >= .05);
  const px = x => bounds.minX + (x + .5) * spacing;
  const pz = z => bounds.minZ + (z + .5) * spacing;
  function free(x, z) {
    if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) return false;
    if (!floors.some(f => Math.abs(x - f.x) <= f.w / 2 && Math.abs(z - f.z) <= f.d / 2)) return false;
    for (const box of obstacles) {
      // Shortest distance from a disc centre to the solid rectangle, including corners.
      const closestX = Math.max(box.minX, Math.min(x, box.maxX));
      const closestZ = Math.max(box.minZ, Math.min(z, box.maxZ));
      if ((x - closestX) ** 2 + (z - closestZ) ** 2 < radius ** 2) return false;
    }
    return true;
  }
  const walkable = new Uint8Array(width * depth);
  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) walkable[z * width + x] = Number(free(px(x), pz(z)));
  }
  function localCells(point) {
    const x = Math.floor((point.x - bounds.minX) / spacing);
    const z = Math.floor((point.z - bounds.minZ) / spacing);
    const result = [];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, zz = z + dz;
      if (xx < 0 || xx >= width || zz < 0 || zz >= depth) continue;
      const index = zz * width + xx;
      if (!walkable[index]) continue;
      // The actual object position must connect to the sampled cell without crossing a wall.
      let connected = true;
      for (let t = 0; t <= 1; t += .2) {
        if (!free(point.x + (px(xx) - point.x) * t, point.z + (pz(zz) - point.z) * t)) {
          connected = false; break;
        }
      }
      if (connected) result.push(index);
    }
    return result;
  }

  assert(free(world.spawn.x, world.spawn.z), `${label}: spawn collides or has no floor`);
  const starts = localCells(world.spawn);
  assert(starts.length, `${label}: spawn has no accessible grid cell`);
  const visited = new Uint8Array(width * depth), queue = new Uint32Array(width * depth);
  let head = 0, tail = 1;
  queue[0] = starts[0]; visited[starts[0]] = 1;
  while (head < tail) {
    const index = queue[head++], x = index % width, z = Math.floor(index / width);
    const candidates = [x ? index - 1 : -1, x + 1 < width ? index + 1 : -1,
      z ? index - width : -1, z + 1 < depth ? index + width : -1];
    for (const next of candidates) {
      if (next < 0 || visited[next] || !walkable[next]) continue;
      // No diagonal corner-cutting; midpoints protect thin geometry between grid centres.
      const xx = next % width, zz = Math.floor(next / width);
      if (!free((px(x) + px(xx)) / 2, (pz(z) + pz(zz)) / 2)) continue;
      visited[next] = 1; queue[tail++] = next;
    }
  }
  const targets = [
    ...world.cores.map((p, i) => ({ ...p, role: `relay ${i + 1}` })),
    { ...world.exit, role: 'exit' },
    ...world.enemies.map((p, i) => ({ ...p, role: `enemy ${i + 1}` })),
    ...world.pickups.map((p, i) => ({ ...p, role: `pickup ${i + 1}` }))
  ];
  for (const target of targets) {
    assert(free(target.x, target.z), `${label}: ${target.role} collides at ${target.x},${target.z}`);
    assert(localCells(target).some(index => visited[index]),
      `${label}: ${target.role} is unreachable from spawn at ${target.x},${target.z}`);
  }
  return { accessibleCells: tail, targets: targets.length };
}

const summary = [], signatures = new Set();
for (const seed of seeds) for (let stage = 0; stage < 3; stage++) {
  const label = `seed ${seed}, stage ${stage}`;
  const world = create(seed, stage), repeated = create(seed, stage);
  finiteNumbers(world);
  const serialized = JSON.stringify(world);
  assert.equal(serialized, JSON.stringify(repeated), `${label}: nondeterministic generation`);
  signatures.add(createHash('sha256').update(serialized).digest('hex'));
  assert.equal(world.cores.length, 3, `${label}: expected three required relays`);
  for (const box of world.colliders) {
    assert(box.minX <= box.maxX && box.minY <= box.maxY && box.minZ <= box.maxZ,
      `${label}: reversed collider bounds`);
  }
  const entry = reachability(world, label);
  summary.push({ seed, stage, ...entry });
}
assert.equal(signatures.size, seeds.length * 3, 'Seeds/stages unexpectedly produce identical worlds');
console.log(JSON.stringify({
  status: 'PASS', cases: summary.length, radius, spacing,
  checks: ['finite values', 'determinism', 'spawn clearance', 'independent flood fill',
    'all relays reachable', 'exit reachable', 'enemy and pickup placement'],
  accessibleCells: { min: Math.min(...summary.map(s => s.accessibleCells)),
    max: Math.max(...summary.map(s => s.accessibleCells)) },
  targetsChecked: summary.reduce((sum, s) => sum + s.targets, 0)
}, null, 2));

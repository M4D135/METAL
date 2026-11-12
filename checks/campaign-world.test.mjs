// Independent campaign generation checks. All geometry is generated locally;
// physical reachability uses a capsule-width raster, not the world's validator.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const source = fileURLToPath(new URL('../src/world.js', import.meta.url));
const context = { window: {} };
vm.runInNewContext(readFileSync(source, 'utf8'), context, { filename: source });
const { create } = context.window.FWorld;
const seeds = [1, 96, 2026], radius = .28, spacing = .5;
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const legacyHashes = [
  [1, 0, '2a488a2ae7b6b92626cc7d8b099472c2e843dd81f476c268919e8e3be026abb6'],
  [1, 1, '530cc4da44cfbdee311cef3bde99c1835b8772ad9d9804a2d768cefa2f18cd2e'],
  [1, 2, '360ff380dafda6b98058cc6ca8869961f6f85e2a63f2b0332f851deea7d55d4f'],
  [96, 0, '173c9d30b0bad0d8a734898ff086353315c8b47c45f4faf0b86c9019674638d7'],
  [96, 1, '3ddc4fabaa9873c6979324d724f7d8de4ae2e0c8ad22571d10770e3fa1d791ea'],
  [96, 2, '4b26155e9721e2d4bbcd9c7235eab2f153391caa2add2f0d1606d8f70f78cc42'],
];

function finite(value, label) {
  if (typeof value === 'number') assert(Number.isFinite(value), `${label}: non-finite generated number`);
  else if (value && typeof value === 'object') for (const child of Object.values(value)) finite(child, label);
}
function heightAt(world, x, z) {
  const surfaces = world.walkable.filter(f => Math.abs(x - f.x) <= f.w / 2 + 1e-7 && Math.abs(z - f.z) <= f.d / 2 + 1e-7);
  const primary = surfaces.filter(f => !f.substrate && !f.fallback);
  const chosen = primary.length ? primary : surfaces;
  const flats = chosen.filter(f => !f.slopeX && !f.slopeZ);
  return Math.max(...(flats.length ? flats : chosen).map(f => (f.y || 0) + (x - f.x) * (f.slopeX || 0) + (z - f.z) * (f.slopeZ || 0)));
}
function touches(x, z, y, box) {
  if (box.minY >= y + 1.8 - 1e-7 || box.maxY <= y + .06) return false;
  const dx = Math.max(box.minX - x, 0, x - box.maxX), dz = Math.max(box.minZ - z, 0, z - box.maxZ);
  return dx * dx + dz * dz < radius * radius;
}
function navigation(world, label) {
  const bounds = world.bounds, nx = Math.ceil((bounds.maxX - bounds.minX) / spacing), nz = Math.ceil((bounds.maxZ - bounds.minZ) / spacing), count = nx * nz;
  assert(count < 300000, `${label}: campaign expanded the navigation budget`);
  const px = ix => bounds.minX + (ix + .5) * spacing, pz = iz => bounds.minZ + (iz + .5) * spacing;
  const bucketSize = 4, buckets = new Map(), key = (x, z) => Math.floor(x / bucketSize) + ',' + Math.floor(z / bucketSize);
  for (const box of world.colliders) for (let z = Math.floor((box.minZ - radius) / bucketSize); z <= Math.floor((box.maxZ + radius) / bucketSize); z++) for (let x = Math.floor((box.minX - radius) / bucketSize); x <= Math.floor((box.maxX + radius) / bucketSize); x++) {
    const k = x + ',' + z;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(box);
  }
  const staticClear = (x, z, y) => Number.isFinite(y) && x - radius >= bounds.minX && x + radius <= bounds.maxX && z - radius >= bounds.minZ && z + radius <= bounds.maxZ && !(buckets.get(key(x, z)) || []).some(box => touches(x, z, y, box));
  const heights = new Float64Array(count), base = new Uint8Array(count);
  for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
    const i = z * nx + x, xx = px(x), zz = pz(z), y = heightAt(world, xx, zz);
    heights[i] = y; base[i] = staticClear(xx, zz, y);
  }
  const index = (x, z) => Math.floor((z - bounds.minZ) / spacing) * nx + Math.floor((x - bounds.minX) / spacing);
  return function flood(closedDoors = [], avoidHazards = false) {
    const doors = closedDoors.map(d => ({ minX: d.x - d.w / 2, maxX: d.x + d.w / 2, minZ: d.z - d.d / 2, maxZ: d.z + d.d / 2, minY: d.y, maxY: d.y + d.h }));
    const safe = (x, z, y) => !doors.some(d => touches(x, z, y, d)) && (!avoidHazards || !world.hazards.some(h => Math.abs(h.y - y) < 1 && Math.hypot(h.x - x, h.z - z) < h.r + radius));
    const clear = (x, z, y) => staticClear(x, z, y) && safe(x, z, y);
    const mask = base.slice(), seen = new Uint8Array(count), queue = new Uint32Array(count);
    for (let i = 0; i < count; i++) if (mask[i]) mask[i] = safe(px(i % nx), pz(Math.floor(i / nx)), heights[i]);
    const first = index(world.spawn.x, world.spawn.z);
    assert(mask[first], `${label}: spawn starts in collision`);
    let head = 0, tail = 1; queue[0] = first; seen[first] = 1;
    while (head < tail) {
      const i = queue[head++], ix = i % nx, iz = Math.floor(i / nx), x = px(ix), z = pz(iz);
      for (const j of [ix ? i - 1 : -1, ix + 1 < nx ? i + 1 : -1, iz ? i - nx : -1, iz + 1 < nz ? i + nx : -1]) {
        if (j < 0 || !mask[j] || seen[j] || Math.abs(heights[i] - heights[j]) > .4) continue;
        const mx = (x + px(j % nx)) / 2, mz = (z + pz(Math.floor(j / nx))) / 2, my = heightAt(world, mx, mz);
        if (Math.abs(my - heights[i]) > .4 || Math.abs(my - heights[j]) > .4 || !clear(mx, mz, my)) continue;
        seen[j] = 1; queue[tail++] = j;
      }
    }
    function reachable(point) {
      const y = heightAt(world, point.x, point.z);
      if (!clear(point.x, point.z, y)) return false;
      const ix = Math.floor((point.x - bounds.minX) / spacing), iz = Math.floor((point.z - bounds.minZ) / spacing);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const x = ix + dx, z = iz + dz;
        if (x < 0 || x >= nx || z < 0 || z >= nz || !seen[z * nx + x]) continue;
        let valid = true, previous = y;
        for (let step = 1; step <= 6; step++) {
          const t = step / 6, xx = point.x + (px(x) - point.x) * t, zz = point.z + (pz(z) - point.z) * t, yy = heightAt(world, xx, zz);
          if (Math.abs(yy - previous) > .4 || !clear(xx, zz, yy)) { valid = false; break; }
          previous = yy;
        }
        if (valid) return true;
      }
      return false;
    }
    return { reachable, accessibleCells: tail };
  };
}
function assertReachable(world, label) {
  const flood = navigation(world, label), active = new Set();
  for (let pass = 0; pass < 4; pass++) {
    const grid = flood(world.doors.filter(d => !active.has(d.requires))), before = active.size;
    for (const m of world.mechanisms) if (grid.reachable({ x: m.x, z: m.z + .95 })) active.add(m.id);
    if (active.size === before) break;
  }
  assert.equal(active.size, 3, `${label}: circular gate or inaccessible mechanism`);
  const grid = flood(), targets = [...world.cores, world.exit, ...world.pickups, ...world.enemies, ...world.shops, ...world.encounters.flatMap(q => q.spawnEntries), ...world.lifts.flatMap(l => [l.lowerCall, l.upperCall]), ...world.jumpPads.flatMap(p => [p, p.target]), ...(world.trophies || [])];
  for (const point of targets) assert(grid.reachable(point), `${label}: inaccessible target ${point.id ?? point.zoneId ?? ''} at ${point.x},${point.z}`);
  if (world.hazards.length) {
    const safe = flood([], true);
    for (const point of [...world.cores, world.exit, ...world.pickups, ...world.shops, ...(world.trophies || [])]) assert(safe.reachable(point), `${label}: hot vents cut off an objective or supply`);
  }
  return { targets: targets.length, accessibleCells: grid.accessibleCells };
}

for (const [seed, stage, expected] of legacyHashes) test(`legacy seed ${seed}, sector ${stage}: exact pre-campaign world fingerprint`, () => {
  assert.equal(digest(create(seed, stage)), expected);
});

test('campaign mode is strictly opt-in and keeps historical clamping otherwise', () => {
  const expected = legacyHashes.find(([seed, stage]) => seed === 96 && stage === 2)[2];
  for (const options of [undefined, {}, { campaign: false }, { campaign: 1 }, { campaign: 'true' }, null]) {
    const world = create(96, 17, options);
    assert.equal(digest(world), expected);
    for (const field of ['campaign', 'index', 'chapter', 'chapterTitle']) assert(!Object.hasOwn(world, field));
  }
  assert.equal(create(96, -5, { campaign: true }).index, 0);
  assert.equal(create(96, 99, { campaign: true }).index, 17);
  assert.equal(create(96, 7.9, { campaign: true }).index, 7);
});

test('the first three campaign worlds preserve historical geometry outside campaign supplies and loadout', () => {
  for (let stage = 0; stage < 3; stage++) {
    const world = create(96, stage, { campaign: true });
    for (const key of ['campaign', 'index', 'chapter', 'chapterTitle']) delete world[key];
    const legacy = create(96, stage);
    for (const key of ['weaponSlots', 'startWeapons', 'startAmmo', 'ammoCaps']) world.progression[key] = legacy.progression[key];
    world.pickups = legacy.pickups;
    for (let i = 0; i < world.enemies.length; i++) world.enemies[i].drop = legacy.enemies[i].drop;
    assert.equal(digest(world), legacyHashes.find(([seed, sector]) => seed === 96 && sector === stage)[2]);
  }
});

const signatures = new Map(seeds.map(seed => [seed, new Set()])), artSignatures = Array.from({ length: 3 }, () => ({ layout: new Set(), details: new Set(), nature: new Set(), botanical: new Set() }));
let reachedTargets = 0, minCells = Infinity, maxCells = 0;
for (let index = 0; index < 18; index++) test(`campaign world ${String(index + 1).padStart(2, '0')}: deterministic and physically reachable on three seeds`, () => {
  for (const seed of seeds) {
    const label = `seed ${seed}, world ${index + 1}`, world = create(seed, index, { campaign: true }), repeated = create(seed, index, { campaign: true });
    assert.equal(world.campaign, true); assert.equal(world.index, index); assert.equal(world.stage, index % 3); assert.equal(world.chapter, Math.floor(index / 3));
    assert.equal(world.generation, 6); assert.equal(world.seed, seed); assert.equal(typeof world.chapterTitle, 'string'); assert(world.chapterTitle.length >= 8);
    assert.equal(digest(world), digest(repeated), `${label}: generation is nondeterministic`);
    signatures.get(seed).add(digest(world)); finite(world, label);
    assert(world.meshes.length <= 18000 && world.colliders.length <= 512, `${label}: geometry budget exceeded`);
    assert.equal(world.cores.length, 3); assert.equal(world.mechanisms.length, 3); assert.equal(world.lifts.length, 2); assert.equal(world.jumpPads.length, 3);
    // Campaign adds a finite JSON sentinel for the infinite-ammunition pistol.
    assert.equal(world.progression.weaponSlots, 5);
    assert.deepEqual(Array.from(world.progression.startWeapons), [false, false, false, false, true]);
    assert.deepEqual(Array.from(world.progression.startAmmo), [0, 0, 0, 0, 1]);
    assert.deepEqual(Array.from(world.progression.ammoCaps), [180, 36, 12, 16, 1]);
    assert.equal(world.progression.startShield, false);
    assert.equal(world.enemies.length, [120, 140, 170][world.stage]);
    const unlock = [6, 9, 15, 12, 0], novelty = new Map([[3, 'shield'], [6, 0], [9, 1], [12, 3], [15, 2]]), equipment = world.pickups.filter(q => q.kind === 'weapon' || q.kind === 'shield');
    assert.equal(equipment.length, novelty.has(index) ? 1 : 0, `${label}: campaign equipment is duplicated or out of schedule`);
    if (equipment.length) { const item = equipment[0]; assert(item.id.startsWith('trophy-')); assert.equal(item.trophyId, item.id); assert.equal(item.kind === 'shield' ? 'shield' : item.weapon, novelty.get(index)); }
    for (const q of world.pickups.filter(q => q.kind === 'ammo')) assert(q.weapon < 4 && unlock[q.weapon] <= index && q.requiresWeapon === q.weapon, `${label}: premature or unconditional ammunition cache`);
    for (const e of world.enemies) if (e.drop) assert(e.drop.weapon < 4 && unlock[e.drop.weapon] <= index, `${label}: enemy drops ammunition before its weapon is introduced`);
    const result = assertReachable(world, label); reachedTargets += result.targets; minCells = Math.min(minCells, result.accessibleCells); maxCells = Math.max(maxCells, result.accessibleCells);
    if (seed === 96) {
      const art = artSignatures[world.stage];
      art.layout.add(digest(world.rooms.map(r => [r.x, r.z, r.w, r.d])));
      art.details.add(digest(world.meshes.filter(m => m.detail)));
      art.nature.add(digest(world.meshes.filter(m => m.outdoor && ['boulder', 'grass', 'fern', 'mineral'].includes(m.category))));
      art.botanical.add(digest(world.trees.map(t => world.meshes.slice(t.mesh, t.mesh + t.meshCount))));
    }
  }
});

test('all eighteen layouts and independent art passes retain their own campaign variation', t => {
  for (const seed of seeds) assert.equal(signatures.get(seed).size, 18, `seed ${seed}: campaign worlds are duplicated`);
  for (let stage = 0; stage < 3; stage++) for (const [pass, values] of Object.entries(artSignatures[stage])) assert.equal(values.size, 6, `decor ${stage}: ${pass} repeats across chapters`);
  t.diagnostic(JSON.stringify({ campaignWorlds: 54, seeds, reachedTargets, accessibleCells: { min: minCells, max: maxCells }, legacyFingerprints: legacyHashes.length }));
});

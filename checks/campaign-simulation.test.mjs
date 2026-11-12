import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = { window: {} };
vm.createContext(context);
for (const name of ['destruction', 'economy', 'simulation']) {
  vm.runInContext(readFileSync(new URL(`../src/${name}.js`, import.meta.url), 'utf8'), context, { filename: `${name}.js` });
}
const { FSimulation } = context.window;

function legacyWorld(extra = {}) {
  return {
    seed: 'campaign-simulation', stage: 0, generation: 6, spawn: { x: 0, y: 0, z: 0, yaw: 0 },
    bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    walkable: [{ x: 0, y: 0, z: 0, w: 40, d: 40 }], meshes: [], lights: [], colliders: [], enemies: [], pickups: [],
    cores: [{ id: 0, x: 10, y: 0, z: 10 }, { id: 1, x: 12, y: 0, z: 10 }, { id: 2, x: 14, y: 0, z: 10 }],
    exit: { x: 16, y: 0, z: 10 },
    progression: { version: 1, weaponSlots: 4, startWeapons: [true, false, false, false], startAmmo: [48, 0, 0, 0], startShield: false, ammoCaps: [180, 36, 12, 16], maxActive: 8 },
    ...extra,
  };
}
const campaignWorld = (index, extra = {}) => legacyWorld({ campaign: true, index, chapter: Math.floor(index / 3), stage: index % 3, ...extra });

test('Campaign identity distinguishes repeated decor indices and refuses a foreign-world checkpoint atomically', () => {
  const first = FSimulation.create(campaignWorld(0)), fourth = FSimulation.create(campaignWorld(3));
  const snapshot = first.snapshot(), untouched = JSON.stringify(fourth.snapshot());
  assert.equal(snapshot.stage, fourth.snapshot().stage);
  assert.notEqual(snapshot.fingerprint, fourth.snapshot().fingerprint);
  assert.equal(fourth.restore(snapshot), false);
  assert.equal(JSON.stringify(fourth.snapshot()), untouched);
  const sameWorld = FSimulation.create(campaignWorld(0));
  assert.equal(sameWorld.restore(snapshot), true);
  assert.equal(JSON.stringify(sameWorld.snapshot()), JSON.stringify(snapshot));
});

test('Campaign opt-in preserves the exact historical fingerprint and never silently imports a legacy checkpoint', () => {
  const legacy = FSimulation.create(legacyWorld()), disabled = FSimulation.create(legacyWorld({ campaign: false, index: 9, chapter: 3 }));
  assert.equal(legacy.snapshot().fingerprint, '575kl1', 'Historical four-slot identity must remain unchanged');
  assert.equal(JSON.stringify(disabled.snapshot()), JSON.stringify(legacy.snapshot()));
  const campaign = FSimulation.create(campaignWorld(0)), before = JSON.stringify(campaign.snapshot());
  assert.equal(campaign.restore(legacy.snapshot()), false);
  assert.equal(JSON.stringify(campaign.snapshot()), before);
  assert.equal(legacy.restore(campaign.snapshot()), false);
});

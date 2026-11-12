import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = { window: {} };
vm.createContext(context);
for (const name of ['destruction', 'economy', 'simulation']) {
  vm.runInContext(readFileSync(new URL(`../src/${name}.js`, import.meta.url), 'utf8'), context, { filename: `${name}.js` });
}
const { FSimulation, FEconomy } = context.window;
const plain = value => JSON.parse(JSON.stringify(value));

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
const campaignWorld = (index, extra = {}) => legacyWorld({ campaign: true, index, chapter: Math.floor(index / 3), stage: index % 3,
  progression: { version: 1, weaponSlots: 5, startWeapons: [false, false, false, false, true], startAmmo: [0, 0, 0, 0, 1], startShield: false, ammoCaps: [180, 36, 12, 16, 1], maxActive: 8 }, ...extra });
function advance(sim, seconds, input = {}) {
  for (let remaining = seconds; remaining > 1e-8;) { const dt = Math.min(.025, remaining); sim.step(dt, input); remaining -= dt; }
}
function aim(sim, enemy) {
  const p = sim.state.player, dx = enemy.x - p.x, dz = enemy.z - p.z;
  p.yaw = Math.atan2(dx, -dz); p.pitch = Math.atan2(enemy.y - (p.y + 1.62), Math.hypot(dx, dz));
}

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

test('Five-slot campaign starts with a pistol, keeps both hands distinct and carries a finite loadout between worlds', () => {
  const sim = FSimulation.create(campaignWorld(0));
  assert.deepEqual(plain(sim.exportInventory()), { weapons: [false, false, false, false, true], ammo: [0, 0, 0, 0, 1], shield: false });
  assert.equal(sim.state.weapon, 4); assert.equal(sim.state.equipment.right, 4); assert.equal(sim.state.equipment.left, null);
  assert.equal(sim.selectWeapon(0), false); assert.equal(sim.selectLeftWeapon(4), false);
  const next = FSimulation.create(campaignWorld(3), sim.exportLoadout());
  assert.deepEqual(plain(next.exportLoadout()), plain(sim.exportLoadout()));
  const inventory = { weapons: [true, false, false, false, true], ammo: [7, 0, 0, 0, 1], shield: true };
  const both = FSimulation.create(campaignWorld(6), { inventory, equipment: { right: 4, left: 0, shieldEnergy: 37 } });
  assert.equal(both.selectWeapon(0), true); assert.deepEqual(plain(both.state.equipment), { right: 0, left: 4 });
  assert.equal(both.selectLeftWeapon('shield'), true); assert.equal(both.state.shield.energy, 37);
  const onlySmg = { weapons: [true, false, false, false, false], ammo: [7, 0, 0, 0, 0], shield: false };
  assert.equal(FSimulation.create(campaignWorld(6), { inventory: onlySmg }).state.weapon, 0, 'The validator requires an owned weapon, not an arbitrary mandatory ID');
  for (const change of [q => q.weapons.fill(false), q => q.ammo[4] = 2, q => q.ammo[4] = Infinity, q => delete q.weapons[4], q => q.weapons.pop(), q => q.ammo.push(0), q => q.shield = 1]) {
    const bad = plain(inventory); change(bad); assert.throws(() => FSimulation.create(campaignWorld(0), { inventory: bad }));
  }
  assert.throws(() => FSimulation.create(legacyWorld(), { inventory }));
});

test('Pistol shots are precise, slower than the SMG and unlimited without serialising Infinity or inventing ammunition', () => {
  const world = campaignWorld(0, { enemies: [{ x: 0, y: 0, z: -12, type: 1, drop: false }] }), sim = FSimulation.create(world), enemy = sim.state.enemies[0];
  enemy.cooldown = 30; aim(sim, enemy);
  assert.equal(sim.fire(), true); assert(Math.abs(enemy.hp - 3.8) < 1e-9); assert.equal(sim.state.player.heat, .06);
  assert.equal(sim.fire(), false); advance(sim, .319); assert.equal(sim.fire(), false); advance(sim, .002); assert.equal(sim.fire(), true);
  assert(Math.abs(enemy.hp - 2.6) < 1e-9); assert.equal(sim.state.inventory.ammo[4], 1);
  const event = sim.state.events.find(q => q.name === 'shot'); assert.equal(event.weapon, 4); assert.equal(event.hand, 'right');
  const finite = FSimulation.create(campaignWorld(0), { inventory: { weapons: [true, false, false, false, true], ammo: [3, 0, 0, 0, 1], shield: false } });
  finite.selectWeapon(0); finite.fire(); advance(finite, .126); assert.equal(finite.fire(), true); assert.equal(finite.state.inventory.ammo[0], 1);
  finite.selectWeapon(4); finite.state.inventory.ammo[4] = 0;
  for (let i = 0; i < 30; i++) { advance(finite, .4); assert.equal(finite.fire(), true); }
  assert.equal(finite.state.inventory.ammo[4], 0); assert.equal(finite.state.inventory.ammo[0], 1);
  const saved = finite.snapshot(), json = JSON.stringify(saved);
  assert.equal(saved.arsenalVersion, 2); assert.equal(saved.timers.weaponWait.length, 5); assert(!json.includes('Infinity'));
  const restored = FSimulation.create(finite.state.world); assert.equal(restored.restore(saved), true);
  assert.equal(JSON.stringify(restored.snapshot()), json); advance(restored, .321); assert.equal(restored.fire(), true);
  const before = JSON.stringify(restored.snapshot());
  for (const change of [q => q.timers.weaponWait[4] = .4, q => q.state.equipment.right = 1, q => q.state.inventory.ammo[4] = 2, q => q.state.inventory.weapons.fill(false), q => q.arsenalVersion = 1]) {
    const bad = plain(saved); change(bad); assert.equal(restored.restore(bad), false); assert.equal(JSON.stringify(restored.snapshot()), before);
  }
});

test('Campaign workshops extend capacity safely and cannot sell first discoveries or ammunition for locked weapons', () => {
  const profile = { ...FEconomy.fresh(), credits: 1000 }, world = campaignWorld(0, { shops: [{ id: 'shop', x: 0, y: 0, z: 0 }] });
  const sim = FSimulation.create(world, { economy: profile });
  assert.equal(sim.shopOffers('shop').length, 6, 'Pistol-only inventory offers repair and five upgrades');
  for (const item of ['weapon1', 'weapon2', 'weapon3', 'shield']) {
    const before = JSON.stringify(sim.exportLoadout()); assert.equal(sim.buy('shop', item).reason, 'trophy-required'); assert.equal(JSON.stringify(sim.exportLoadout()), before);
  }
  for (const item of ['ammo0', 'ammo1', 'ammo2', 'ammo3'])assert.equal(sim.buy('shop', item).reason, 'locked-weapon');
  assert.equal(sim.buy('shop', 'capacity').ok, true); assert.deepEqual(plain(sim.ammoCaps), [225, 45, 15, 20, 1]);
  assert.equal(sim.state.inventory.ammo[4], 1); assert.equal(FEconomy.catalog().length, 14);
  assert.deepEqual(plain(FEconomy.ammoCaps(profile)), [180, 36, 12, 16]);
  const state = { profile, inventory: sim.exportInventory(), hp: 90 };
  assert.equal(FEconomy.transact(state, 'repair').reason, 'invalid-state', 'Five slots require an explicit campaign economy call');
  assert.equal(FEconomy.transact(state, 'repair', { campaign: true }).ok, true);
  assert.equal(FEconomy.transact(state, 'weapon2', { campaign: true }).reason, 'trophy-required');
});

test('Campaign caches and enemy loot never give locked or pistol ammunition, and saved loot validates against the saved arsenal', () => {
  const world = campaignWorld(6, { pickups: [{ id: 'locked-ammo', kind: 'ammo', weapon: 2, amount: 2, x: .5, y: 0, z: 0 }],
    enemies: [{ x: 0, y: 0, z: -6, type: 0, drop: { weapon: 2, amount: 1 } }] });
  const sim = FSimulation.create(world); sim.step(0); assert.equal(sim.state.inventory.ammo[2], 0); assert.equal(sim.state.pickups[0].taken, false);
  const enemy = sim.state.enemies[0]; enemy.cooldown = 30; aim(sim, enemy);
  for (let i = 0; i < 3; i++) { aim(sim, enemy); sim.fire(); advance(sim, .4); }
  assert.equal(enemy.hp, 0); assert.deepEqual(plain(sim.state.loot[0].ammo), [0, 0, 0, 0, 0]); assert.equal(sim.state.loot[0].credits, 6);
  const ownedWorld = campaignWorld(6, { enemies: [{ x: 0, y: 0, z: -6, type: 0, drop: { weapon: 0, amount: 6 } }] });
  const owned = FSimulation.create(ownedWorld, { inventory: { weapons: [true, false, false, false, true], ammo: [0, 0, 0, 0, 1], shield: false } });
  owned.state.enemies[0].cooldown = 30; aim(owned, owned.state.enemies[0]);
  for (let i = 0; i < 3; i++) { aim(owned, owned.state.enemies[0]); owned.fire(); advance(owned, .4); }
  assert.deepEqual(plain(owned.state.loot[0].ammo), [6, 0, 0, 0, 0]);
  const saved = owned.snapshot(), resumed = FSimulation.create(ownedWorld); assert.equal(resumed.restore(saved), true);
  assert.deepEqual(plain(resumed.snapshot()), plain(saved));
});

test('A pistol remains usable in the right hand while the left shield is raised', () => {
  const sim = FSimulation.create(campaignWorld(3), { inventory: { weapons: [false, false, false, false, true], ammo: [0, 0, 0, 0, 1], shield: true }, equipment: { right: 4, left: 'shield', shieldEnergy: 100 } });
  sim.step(.025, { fire: true, fireLeft: true });
  assert.equal(sim.state.shield.raised, true); assert.equal(sim.state.shots, 1); assert.equal(sim.state.inventory.ammo[4], 1);
  const saved = sim.snapshot(), resumed = FSimulation.create(sim.state.world); assert.equal(resumed.restore(saved), true);
  assert.equal(JSON.stringify(resumed.snapshot()), JSON.stringify(saved));
});

test('First campaign equipment pickups require the exact calendar world and its unique trophy identity', () => {
  for (const [index, key, weapon] of [[3, 'shield', null], [6, 'smg', 0], [9, 'shotgun', 1], [12, 'grenade', 3], [15, 'rocket', 2]]) {
    const id = 'trophy-' + key, pickup = { id, trophyId: id, kind: weapon === null ? 'shield' : 'weapon', ...(weapon === null ? {} : { weapon }), amount: weapon === null ? 1 : 4, x: .5, y: 0, z: 0 };
    for (const [worldIndex, q, allowed] of [[index, pickup, true], [index - 1, pickup, false], [index + 1, pickup, false], [index, { ...pickup, trophyId: 'invented' }, false], [index, { ...pickup, id: 'ordinary-rack' }, false]]) {
      const sim = FSimulation.create(campaignWorld(worldIndex, { pickups: [q] })); sim.step(.025);
      assert.equal(weapon === null ? sim.state.inventory.shield : sim.state.inventory.weapons[weapon], allowed, `${key} at world index ${worldIndex}`);
      assert.equal(sim.state.pickups[0].taken, allowed);
    }
  }
  const sim = FSimulation.create(campaignWorld(6, { pickups: [{ id: 'dependent-cache', kind: 'ammo', weapon: 4, requiresWeapon: 0, amount: 1, x: .5, y: 0, z: 0 }] }));
  sim.step(.025); assert.equal(sim.state.pickups[0].taken, false); assert.equal(sim.state.inventory.ammo[4], 1);
});

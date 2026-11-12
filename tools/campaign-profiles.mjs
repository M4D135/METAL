import fs from 'node:fs';
import {loadRealm} from './realm-loader.mjs';
import {parseToolArgs} from './proof/common.mjs';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const {root:rootPath,output} = parseToolArgs(process.argv.slice(2));
const root = pathToFileURL(rootPath + '/');
const modules = ['renderer','world','destruction','economy','simulation'];
const sources = Object.fromEntries(modules.map(name=>[name,'src/'+name+'.js']));
const loaded = loadRealm({root:rootPath,modules});
const hashes = loaded.sourceSha256;
const {FWorld,FSimulation} = loaded.window;
const plain = value => JSON.parse(JSON.stringify(value));
const acquisitions = [
  { index: 0, key: 'pistol', weapon: 4, name: 'Pistolet (départ)' },
  { index: 3, key: 'shield', name: 'Bouclier' },
  { index: 6, key: 'smg', weapon: 0, name: 'Mitraillette' },
  { index: 9, key: 'shotgun', weapon: 1, name: 'Double pompe' },
  { index: 12, key: 'grenade', weapon: 3, name: 'Lance-grenades' },
  { index: 15, key: 'rocket', weapon: 2, name: 'Lance-roquettes' },
];

function entryInventory(index, caps) {
  const inventory = { weapons: [false, false, false, false, true], ammo: [0, 0, 0, 0, 1], shield: false };
  for (const gear of acquisitions.slice(1)) if (gear.index < index) {
    if (gear.key === 'shield') inventory.shield = true;
    else { inventory.weapons[gear.weapon] = true; inventory.ammo[gear.weapon] = caps[gear.weapon]; }
  }
  return inventory;
}

function assertFiniteTree(value) {
  if (typeof value === 'number') assert(Number.isFinite(value), 'Non-finite serialized value');
  else if (value && typeof value === 'object') for (const child of Object.values(value)) assertFiniteTree(child);
}

function observe(sim) {
  const state = sim.state;
  const boss = state.enemies.find(e => e.boss && e.bossScale > 1);
  assert(boss, 'The real world must contain its giant boss');
  return {
    inventory: plain(sim.exportInventory()),
    discovered: [...state.campaign.discovered],
    adaptation: plain(state.adaptation),
    boss: { id: boss.id, name: boss.bossName, kind: boss.bossKind, maxHp: boss.maxHp, hp: boss.hp },
    totalActors: state.enemies.length,
    currentCombatCap: state.aiStats.combatCap,
  };
}

const rows = [];
let restoredCheckpoints = 0;
for (let index = 0; index < 18; index++) {
  const world = FWorld.create(96, index, { campaign: true });
  const inventory = entryInventory(index, world.progression.ammoCaps);
  const sim = FSimulation.create(world, { inventory });
  const entry = observe(sim);
  assert.equal(entry.currentCombatCap, entry.adaptation.maxActive);
  assert.equal(entry.totalActors, world.campaignProfile.garrison);
  assert.deepEqual(entry.discovered, acquisitions.filter(a => a.key === 'pistol' || a.index < index).map(a => a.key));
  const checkpoint = plain(sim.snapshot());
  assertFiniteTree(checkpoint);
  const resumed = FSimulation.create(world, { inventory });
  assert.equal(resumed.restore(checkpoint), true, `World ${index + 1} entry checkpoint`);
  assert.deepEqual(plain(resumed.snapshot()), checkpoint);
  restoredCheckpoints++;
  resumed.dispose();

  const trophy = world.trophies[0] || null;
  let afterDiscovery = null;
  if (trophy) {
    // This is an explicit local precondition, not a navigation or combat run.
    const local = { ...world, spawn: { x: trophy.x, y: trophy.y, z: trophy.z, yaw: 0 } };
    const discovery = FSimulation.create(local, { inventory });
    discovery.state.director.grace = 0;
    assert.equal(discovery.blocked(trophy.x, trophy.z, .28, trophy.y), false);
    discovery.step(.025);
    assert.equal(discovery.state.events.filter(e => e.name === 'trophy').length, 1);
    assert.equal(discovery.state.campaign.trophies[0].phase, 'grace');
    afterDiscovery = observe(discovery);
    assert.equal(afterDiscovery.boss.maxHp, entry.boss.maxHp, 'Boss HP stays frozen at entry');
    assert.equal(afterDiscovery.adaptation.entryTier, entry.adaptation.entryTier);
    assert.equal(afterDiscovery.adaptation.bossHpFactor, entry.adaptation.bossHpFactor);
    const saved = plain(discovery.snapshot());
    assertFiniteTree(saved);
    const replay = FSimulation.create(local, { inventory });
    assert.equal(replay.restore(saved), true, `World ${index + 1} discovery checkpoint`);
    assert.deepEqual(plain(replay.snapshot()), saved);
    assert.equal(replay.state.events.some(e => e.name === 'trophy'), false);
    restoredCheckpoints++;
    replay.dispose();
    discovery.dispose();
  }

  const baseBoss = world.enemies.find(e => e.boss && e.bossScale > 1);
  const row = {
    index: world.index,
    worldNumber: world.index + 1,
    stage: world.stage,
    decor: world.title,
    biome: world.environment.biome,
    chapter: world.chapter,
    chapterNumber: world.chapter + 1,
    chapterTitle: world.chapterTitle,
    gift: trophy ? { key: trophy.key, name: trophy.name, pickupId: trophy.pickupId } : index === 0 ? { key: 'pistol', name: 'Pistolet (départ)', pickupId: null } : null,
    enemyCount: world.enemies.length,
    trialEnemyCount: world.enemies.filter(e => e.trophyGuard).length,
    grenadeRosterCount: world.enemies.filter(e => e.weapon === 'grenade').length,
    rocketRosterCount: world.enemies.filter(e => e.weapon === 'rocket').length,
    nominalProfile: plain(world.campaignProfile),
    boss: { name: entry.boss.name, kind: entry.boss.kind, baseMaxHp: baseBoss.maxHp, entryMaxHp: entry.boss.maxHp },
    entry,
    afterDiscovery,
  };
  rows.push(row);
  sim.dispose();
}

for (const [name, path] of Object.entries(sources)) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL(path, root))).digest('hex'), hashes[name], 'Source changed during measurement: ' + name);
const report = {
  schema: 'metal-campaign-api-profile-v1',
  seed: 96,
  sources,
  sourceSha256: hashes,
  method: {
    entryInventory: 'Pistol from the start; only scheduled gifts at strictly earlier indices are owned. Owned finite-ammo weapons start at their base capacity for this profile measurement; these are controlled inputs, not measured combat ammunition.',
    discovery: 'FSimulation.create on the full generated world with a local valid spawn at the trophy, then step(.025). The real pickup code grants the gift; this is not a traversal benchmark.',
    multipliers: 'The reported damage/cadence values are the campaign adaptation multipliers. Selected difficulty, biome stage, director progress, attack-specific cooldowns and player upgrades compose separately.',
    boss: 'entryMaxHp is the actual runtime value, frozen when entering the world. baseMaxHp is the chapter-scaled generated value before the missing-arsenal adjustment.',
    heavyCounts: 'grenadeRosterCount and rocketRosterCount count finite predefined identities. Their explosive attacks are gated at runtime by owned shield and, for rockets, at least one heavy weapon.',
    enemies: 'enemyCount includes the boss, its six reinforcements and any three conditional trophy guards; it is not a simultaneous-combat count.',
  },
  checks: { worlds: rows.length, discoveryPickups: rows.filter(r => r.afterDiscovery).length, exactCheckpointRoundTrips: restoredCheckpoints, finiteSerializedValues: true, unchangedSourcesDuringRun: true },
  totals: { enemies: rows.reduce((sum, r) => sum + r.enemyCount, 0), conditionalTrophyGuards: rows.reduce((sum, r) => sum + r.trialEnemyCount, 0) },
  worlds: rows,
};
const json = JSON.stringify(report, null, 2) + '\n';
if (output) fs.writeFileSync(output, json); else process.stdout.write(json);

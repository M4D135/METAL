// Reproducible combat measurements, not a playthrough or a hardware benchmark.
// Four real generated infantry definitions fight a moving input-driven bot in
// the same small arena. No health, position or enemy state changes during combat.
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const context = { window: {} }; vm.createContext(context);
for (const name of ['renderer', 'world', 'destruction', 'economy', 'brain', 'simulation']) {
  vm.runInContext(readFileSync(new URL(`../src/${name}.js`, import.meta.url), 'utf8'), context, { filename: `${name}.js` });
}
const { FWorld, FSimulation, FBrain } = context.window;
const clone = value => JSON.parse(JSON.stringify(value));
const round = value => Math.round(value * 1000) / 1000;
const angle = value => Math.atan2(Math.sin(value), Math.cos(value));

function inventory(index, scenario) {
  const weapons = [false, false, false, false, true];
  if (scenario === 'nominal')for (const [at, weapon] of [[6, 0], [9, 1], [12, 3], [15, 2]])if (index >= at)weapons[weapon] = true;
  return { weapons, ammo: weapons.map((owned, id) => owned ? [80, 16, 6, 8, 1][id] : 0), shield: scenario === 'nominal' && index >= 3 };
}

function arena(generated) {
  const infantry = generated.enemies.filter(e => e.type < 3 && !e.bossWave && !e.trophyGuard);
  const locations = [[-7, -8], [-2, -14], [3, -9], [8, -16]];
  const enemies = locations.map(([x, z], i) => {
    const source = infantry[Math.min(infantry.length - 1, Math.floor(infantry.length * [.10, .35, .60, .85][i]))];
    return { x, y: 0, z, type: source.type, role: source.role, ...(source.weapon ? { weapon: source.weapon } : {}), squadId: i % 2, drop: false };
  });
  return {
    seed: 'balance-' + generated.seed + '-' + generated.index, generation: 6, campaign: true, index: generated.index, chapter: generated.chapter, stage: generated.stage,
    spawn: { x: 0, y: 0, z: 12, yaw: 0 }, bounds: { minX: -24, maxX: 24, minZ: -24, maxZ: 24 },
    walkable: [{ x: 0, y: 0, z: 0, w: 48, d: 48 }], meshes: [], lights: [],
    colliders: [{ minX: -5, maxX: -3, minY: 0, maxY: 1, minZ: 0, maxZ: 2 }, { minX: 4, maxX: 6, minY: 0, maxY: 1, minZ: -3, maxZ: -1 }],
    enemies, pickups: [], trophies: [], encounters: [],
    cores: [{ id: 0, x: 22, y: 0, z: 20 }, { id: 1, x: 22, y: 0, z: 21 }, { id: 2, x: 22, y: 0, z: 22 }], exit: { x: -22, y: 0, z: 22 },
    progression: clone(generated.progression), campaignProfile: clone(generated.campaignProfile), director: { enabled: true },
  };
}

function fight(generated, scenario) {
  const loadout = inventory(generated.index, scenario), world = arena(generated), brain = FBrain.create({ mode: 'cpu' });
  const sim = FSimulation.create(world, { inventory: loadout, equipment: { right: loadout.weapons[0] ? 0 : 4, left: loadout.shield ? 'shield' : null, shieldEnergy: 100 }, brain });
  sim.setDifficulty(0);
  // The experiment starts in combat, so its initial condition has no spawn grace.
  sim.state.director.grace = 0;
  const dt = .025, limit = 90, startAmmo = sim.exportInventory().ammo, spent = [0, 0, 0, 0, 0];
  let elapsed = 0, peakCombat = 0;
  while (elapsed < limit && !sim.state.dead && sim.state.kills < world.enemies.length) {
    const p = sim.state.player, alive = sim.state.enemies.filter(e => e.hp > 0 && e.deployed);
    const visible = alive.filter(e => sim.sight(p.x, p.z, e.x, e.z, p.y + 1.62, e.y));
    const target = (visible.length ? visible : alive).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    if (!target)break;
    const dx = target.x - p.x, dz = target.z - p.z, distance = Math.hypot(dx, dz), yaw = Math.atan2(dx, -dz), pitch = Math.atan2(target.y - (p.y + 1.62), distance);
    const inv = sim.state.inventory, cluster = alive.filter(e => Math.hypot(e.x - target.x, e.z - target.z) < 3).length;
    let weapon = inv.weapons[0] && inv.ammo[0] > 0 ? 0 : 4;
    if (inv.weapons[1] && inv.ammo[1] > 0 && distance < 10)weapon = 1;
    else if (inv.weapons[2] && inv.ammo[2] > 0 && distance > 9 && cluster > 1)weapon = 2;
    else if (inv.weapons[3] && inv.ammo[3] > 0 && distance > 9 && distance < 16 && cluster > 1)weapon = 3;
    const goalX = Math.sin(elapsed * .35) * 10, goalZ = 4 + Math.cos(elapsed * .35) * 7;
    const gx = goalX - p.x, gz = goalZ - p.z, length = Math.max(1, Math.hypot(gx, gz));
    const before = inv.ammo.slice();
    sim.step(dt, { lookX: angle(yaw - p.yaw), lookY: pitch - p.pitch, weapon,
      moveX: (Math.cos(yaw) * gx + Math.sin(yaw) * gz) / length,
      moveY: (Math.sin(yaw) * gx - Math.cos(yaw) * gz) / length,
      fire: visible.length > 0, fireLeft: inv.shield && sim.state.shield.energy > 8 });
    for (let i = 0; i < spent.length; i++)spent[i] += Math.max(0, before[i] - sim.state.inventory.ammo[i]);
    peakCombat = Math.max(peakCombat, sim.state.aiStats.combat); elapsed += dt;
    if (!Number.isFinite(p.hp) || sim.state.aiStats.combat > sim.state.adaptation.maxActive)throw new Error('Invalid combat budget or health');
  }
  const result = {
    scenario, outcome: sim.state.kills === world.enemies.length ? 'cleared' : sim.state.dead ? 'dead' : 'timeout',
    seconds: round(elapsed), kills: sim.state.kills, enemies: world.enemies.length, damageTaken: round(100 - sim.state.player.hp),
    shots: sim.state.shots, hits: sim.state.hits, ammoConsumed: spent, startingAmmo: startAmmo,
    distanceMoved: round(sim.state.locomotion.distance), peakCombat,
    adaptation: clone(sim.state.adaptation), enemyTypes: world.enemies.map(e => ({ type: e.type, weapon: e.weapon || 'rifle' })),
  };
  sim.dispose(); brain.dispose(); return result;
}

const rows = [];
for (let index = 0; index < 18; index++) {
  const generated = FWorld.create(96, index, { campaign: true });
  rows.push({ world: index + 1, index, chapter: generated.chapter + 1, decor: generated.stage, title: generated.title,
    garrison: generated.enemies.length, profile: clone(generated.campaignProfile), combats: ['nominal', 'pistol-only'].map(scenario => fight(generated, scenario)) });
}
const output = { version: 1, seed: 96, simulationHz: 40, difficulty: 0, limitSeconds: 90,
  methodology: 'Four infantry definitions sampled deterministically from each generated world. Identical small 3D arena with two physical covers. A bot moves, aims, selects owned weapons, fires and raises its owned shield through normal step inputs. CPU tactical network; no imported assets. No health or enemy-state mutation during combat. Initial spawn grace is disabled. Nominal assumes scheduled trophies have been found; pistol-only omits every optional discovery. These are controlled simulations, not complete campaign runs, human playtests, FPS measurements or real-device validation.',
  weaponOrder: ['smg', 'shotgun', 'rocket', 'grenade', 'pistol'], rows };
const json = JSON.stringify(output, null, 2) + '\n';
if (process.argv[2])writeFileSync(process.argv[2], json); else process.stdout.write(json);

// Banc du lot « jeu-pieges-massifs » : les pièges barrent le chemin obligatoire.
// Décision de David du 13/11 (MASTER-PROMPT §6 ter point 2) : un piège est sur le
// seul passage qui relie deux zones, il le coupe en travers sur toute sa largeur,
// et un secteur sans piège est une erreur. Le chemin est calculé (FPassages),
// jamais deviné : on prouve par la grille de navigation qu'un piège barre le
// passage, et qu'un relais, la sortie ou un objet reste atteignable.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRealm } from '../tools/realm-loader.mjs';

const { window } = loadRealm({ modules: ['fmath', 'passages', 'world'] });
const { FWorld, FPassages } = window;
assert(FPassages, 'src/passages.js doit exposer FPassages');

const seeds = [1, 96, 2026], RADIUS = 0.38, CELL = 0.8, STEP = 0.42;
const roomAt = (w, x, z) => w.rooms.find(r => Math.abs(x - r.x) <= r.w / 2 + 0.3 && Math.abs(z - r.z) <= r.d / 2 + 0.3)?.id;
const corridorAt = (w, x, z) => w.corridors.findIndex(c => Math.abs(x - c.x) <= c.w / 2 + 0.05 && Math.abs(z - c.z) <= c.d / 2 + 0.05);

// Grille de navigation du monde, indexée par cellule pour rester rapide.
function navigation(w) {
  const buckets = new Map();
  const key = (ix, iz) => iz * 4096 + ix;
  const nx = Math.ceil((w.bounds.maxX - w.bounds.minX) / CELL), nz = Math.ceil((w.bounds.maxZ - w.bounds.minZ) / CELL);
  for (const c of w.colliders) {
    for (let ix = Math.max(0, Math.floor((c.minX - RADIUS - w.bounds.minX) / CELL)); ix <= Math.min(nx - 1, Math.ceil((c.maxX + RADIUS - w.bounds.minX) / CELL)); ix++)
      for (let iz = Math.max(0, Math.floor((c.minZ - RADIUS - w.bounds.minZ) / CELL)); iz <= Math.min(nz - 1, Math.ceil((c.maxZ + RADIUS - w.bounds.minZ) / CELL)); iz++) {
        const k = key(ix, iz), list = buckets.get(k);
        if (list) list.push(c); else buckets.set(k, [c]);
      }
  }
  const solidAt = (x, z, y) => {
    const list = buckets.get(key(Math.floor((x - w.bounds.minX) / CELL), Math.floor((z - w.bounds.minZ) / CELL)));
    if (!list) return false;
    for (const c of list) {
      if (c.minY >= y + 1.85 || c.maxY <= y + 0.05) continue;
      const dx = Math.max(c.minX - x, 0, x - c.maxX), dz = Math.max(c.minZ - z, 0, z - c.maxZ);
      if (dx * dx + dz * dz <= RADIUS * RADIUS) return true;
    }
    return false;
  };
  return FPassages.grid({ bounds: w.bounds, cell: CELL, heightAt: (x, z) => FWorld.floorHeight(w, x, z), solidAt, radius: RADIUS, height: 1.8, step: STEP });
}

// Empreinte balayée d'un piège : tout le volume qu'il occupe à un moment du cycle.
function swept(t) {
  const travel = Math.max(0, t.travel || 0), axis = t.kind === 'blade' ? (t.axis === 'z' ? 'z' : 'x') : null;
  const minX = t.x - t.w / 2 - (axis === 'x' ? travel : 0), maxX = t.x + t.w / 2 + (axis === 'x' ? travel : 0);
  const minZ = t.z - t.d / 2 - (axis === 'z' ? travel : 0), maxZ = t.z + t.d / 2 + (axis === 'z' ? travel : 0);
  const base = t.baseY ?? t.y, top = t.kind === 'blade' ? t.y + (t.h || 0.3) : base + Math.max(t.h || 0.65, t.travel || 0) + 0.05;
  return { minX, maxX, minY: Math.min(t.y, base), maxY: Math.max(top, t.y + (t.h || 0.3)), minZ, maxZ };
}
const union = boxes => boxes.length && {
  minX: Math.min(...boxes.map(b => b.minX)), maxX: Math.max(...boxes.map(b => b.maxX)),
  minY: Math.min(...boxes.map(b => b.minY)), maxY: Math.max(...boxes.map(b => b.maxY)),
  minZ: Math.min(...boxes.map(b => b.minZ)), maxZ: Math.max(...boxes.map(b => b.maxZ))
};

// Les deux bouts d'un couloir, le long de son axe long.
function corridorProbes(c) {
  const alongX = c.w >= c.d, half = (alongX ? c.w : c.d) / 2 - 1.1;
  return alongX
    ? [{ x: c.x - half, z: c.z }, { x: c.x + half, z: c.z }]
    : [{ x: c.x, z: c.z - half }, { x: c.x, z: c.z + half }];
}

function analyse(w) {
  const links = w.connections.map(c => ({ from: c.from, to: c.to, x1: c.x1, z1: c.z1, x2: c.x2, z2: c.z2 }));
  const start = roomAt(w, w.spawn.x, w.spawn.z);
  const objectives = [...w.cores.map(c => roomAt(w, c.x, c.z)), w.bossArena?.room ?? roomAt(w, w.exit.x, w.exit.z), roomAt(w, w.exit.x, w.exit.z)].filter((v, i, a) => v !== undefined && a.indexOf(v) === i);
  const mandatory = FPassages.mandatoryLinks({ links, start, objectives });
  const tour = FPassages.tourLinks({ links, start, objectives });
  const grid = navigation(w);
  const source = FPassages.nearestFree(grid, w.spawn, 4);
  return { links, start, objectives, mandatory, tour, grid, source };
}

const worlds = [];
for (const seed of seeds) for (const mode of [['classique', {}], ['campagne', { campaign: true }], ['campagne V2', { campaign: true, campaignVersion: 2 }]]) {
  const indices = mode[0] === 'classique' ? [0, 1, 2] : mode[0] === 'campagne V2' ? Array.from({ length: 18 }, (_, i) => i) : [0, 3, 6, 9, 12, 17];
  for (const index of indices) {
    worlds.push({ label: `seed ${seed}, ${mode[0]} ${index + 1}`, world: FWorld.create(seed, index, mode[1]) });
  }
}

for (const { label, world: w } of worlds) {
  test(`${label} : chaque piège barre un passage obligatoire du secteur`, () => {
    assert.ok(w.traps.length > 0, `${label}: le secteur ne pose aucun piège`);
    const { mandatory, tour, grid, source } = analyse(w);
    assert.ok(mandatory.length > 0, `${label}: aucun lien obligatoire calculé, le chemin n'est pas fermé`);
    const onPath = new Set([...mandatory, ...tour]);
    const barriers = new Map();
    for (const t of w.traps) {
      const corridor = corridorAt(w, t.x, t.z);
      assert.notEqual(corridor, -1, `${label}: le piège ${t.id} (${t.kind}) est hors d'un passage (couloir, porte, pont, brèche, sortie d'arène)`);
      const link = w.connections.findIndex((c, i) => i === corridor);
      assert.ok(link >= 0 && onPath.has(link), `${label}: le piège ${t.id} est dans un couloir que la tournée obligatoire n'emprunte pas`);
      const id = t.barrier ?? t.id;
      if (!barriers.has(id)) barriers.set(id, { corridor, boxes: [], kinds: [] });
      barriers.get(id).boxes.push(swept(t));
      barriers.get(id).kinds.push(t.kind);
    }
    // Une barrière doit être une machine massive : au moins deux pièces, ou une
    // presse pleine largeur, et un volume qui couvre toute la hauteur du corps.
    const arena = w.bossArena ? { x: w.bossArena.x, z: w.bossArena.z } : w.exit;
    let cutting = 0;
    for (const [id, b] of barriers) {
      const c = w.corridors[b.corridor], probes = corridorProbes(c), box = union(b.boxes);
      const low = Math.min(...b.boxes.map(q => q.minY)), high = Math.max(...b.boxes.map(q => q.maxY));
      assert.ok(low <= c.y + 0.2 && high >= c.y + 1.8, `${label}: la barrière ${id} laisse passer debout (${low.toFixed(2)} à ${high.toFixed(2)} pour un corps de 1,80 m)`);
      const region = { minX: c.x - c.w / 2, maxX: c.x + c.w / 2, minZ: c.z - c.d / 2, maxZ: c.z + c.d / 2 };
      const from = [grid.index(probes[0].x, probes[0].z)];
      const open = FPassages.reaches(grid, from, probes[1], [], region);
      assert.ok(open, `${label}: la barrière ${id} est posée dans un couloir qu'on ne peut pas traverser à vide`);
      const blocked = !FPassages.reaches(grid, from, probes[1], b.boxes, region);
      assert.ok(blocked, `${label}: la barrière ${id} ne coupe pas le couloir ${b.corridor} sur toute sa largeur`);
      if (mandatory.includes(b.corridor) && FPassages.cuts(grid, w.spawn, arena, box)) cutting++;
    }
    assert.ok(cutting > 0, `${label}: aucun piège ne barre le seul passage obligatoire du secteur`);
  });

  test(`${label} : relais, sortie et objets restent atteignables`, () => {
    const { grid, source } = analyse(w);
    const targets = [w.exit, ...w.cores, ...w.pickups, ...w.mechanisms.map(m => ({ x: m.x, z: m.z + 0.95 })), ...(w.bossArena ? [{ x: w.bossArena.x, z: w.bossArena.z }] : [])];
    for (const [i, t] of targets.entries()) assert.ok(FPassages.reaches(grid, source, t), `${label}: cible ${i} injoignable depuis le départ`);
  });
}

test('FPassages distingue un couloir obligatoire d un couloir de contournement', () => {
  const ring = [{ from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 0 }, { from: 2, to: 3 }];
  assert.deepEqual(FPassages.mandatoryLinks({ links: ring, start: 0, objectives: [3] }), [3]);
  assert.deepEqual(FPassages.mandatoryLinks({ links: ring, start: 0, objectives: [1, 2] }), []);
  const line = [{ from: 0, to: 1, x1: 0, z1: 0, x2: 10, z2: 0 }, { from: 1, to: 2, x1: 10, z1: 0, x2: 20, z2: 0 }];
  assert.deepEqual(FPassages.tourLinks({ links: line, start: 0, objectives: [2] }), [0, 1]);
});

// --- T4 : la destruction des machines suit la règle du lot 14 --------------------
// « Aux explosifs, tout casse sauf le sol ; les armes légères sont limitées. »
// Appliquée au danger obligatoire du secteur : une explosion démonte la coupe, une
// arme légère l'abîme sans jamais la finir. Et démonter une machine ne doit jamais
// couper un chemin : les pièges ne posent aucun collier solide permanent.
const simWindow = loadRealm({ modules: ['fmath', 'passages', 'renderer', 'world', 'destruction', 'economy', 'brain', 'simulation'] }).window;
const simOptions = () => ({ brain: simWindow.FBrain.create({ mode: 'cpu' }), armorSystem: true });
const firstCoupe = w => { const barrier = [...new Set(w.traps.map(t => t.barrier))][0]; return { barrier, ids: w.traps.filter(t => t.barrier === barrier).map(t => t.id) }; };
const piecesOf = (sim, ids) => sim.state.traps.filter(t => ids.includes(t.id));

test('une explosion démonte la machine qui barre le chemin obligatoire', () => {
  const world = FWorld.create(1, 2, { campaign: true, campaignVersion: 2 });
  const { ids } = firstCoupe(world), sim = simWindow.FSimulation.create(world, simOptions()), pieces = piecesOf(sim, ids);
  assert.ok(pieces.some(t => t.kind === 'blade'), 'le secteur ne pose aucune lame à démonter');
  // Explosifs réels (mêmes paramètres que la roquette : rayon 4,2, puissance de
  // terrain 55) posés au centre des pièces encore debout. Le banc pose la charge,
  // il ne rejoue pas la balistique du lance-roquettes — couverte par
  // checks/simulation.test.mjs. Une machine de 5 m de fond ne tient pas dans un
  // seul cratère : on remet une charge jusqu'à ce que la coupe soit démontée.
  for (let shots = 0; shots < 6 && pieces.some(t => !t.destroyed); shots++) {
    const live = pieces.filter(t => !t.destroyed);
    const centre = ['x', 'y', 'z'].map(k => live.reduce((n, t) => n + t[k], 0) / live.length);
    sim.state.projectiles.push({ id: 100 + shots, kind: 'grenade', owner: 'player', x: centre[0], y: centre[1] + .6, z: centre[2],
      vx: 0, vy: 0, vz: 0, age: 0, life: 1, fuse: 0, radius: .12, blastRadius: 4.2, damage: 32, terrainPower: 55, travel: 0, bounces: 0, resting: true });
    sim.step(.025, {});
  }
  assert.ok(pieces.every(t => t.destroyed), 'une explosion doit démonter toute la coupe : ' + pieces.map(t => `${t.kind}:${t.hp}`).join(' '));
  assert.ok(pieces.every(t => t.box === null), 'une machine démontée ne bloque plus le couloir');
});

test('une arme légère abîme la machine sans jamais la démonter', () => {
  const world = FWorld.create(1, 2, { campaign: true, campaignVersion: 2 });
  const { barrier, ids } = firstCoupe(world), sim = simWindow.FSimulation.create(world, simOptions()), pieces = piecesOf(sim, ids);
  const spikes = world.traps.find(t => t.barrier === barrier && t.kind === 'spikes');
  const press = world.traps.find(t => t.barrier === barrier && t.kind === 'press');
  const axis = spikes.x !== press.x ? 'x' : 'z', sign = Math.sign(spikes[axis] - press[axis]);
  const x = spikes.x + sign * 6, z = spikes.z + (axis === 'x' ? 0 : sign * 6), y = sim.ground(x, z);
  Object.assign(sim.state.player, { x, z, y, yaw: Math.atan2(press.x - x, press.z - z), pitch: 0 });
  for (let i = 0; i < 1200 && !pieces.some(t => t.hp <= 1); i++) sim.step(.025, { weapon: 0, fire: i % 3 === 0 });
  assert.ok(pieces.every(t => !t.destroyed && t.hp >= 1), 'une arme légère a démonné la machine du chemin obligatoire');
  assert.ok(pieces.some(t => t.hp < 18), 'les tirs doivent quand même marquer la machine');
});

test('démonter les machines ne coupe aucun chemin : elles ne portent aucun collier solide', () => {
  for (const { label, world: w } of worlds) {
    const groups = new Map(w.destructibles.map(g => [g.id, g]));
    for (const id of new Set(w.traps.map(t => t.destructibleId))) {
      const g = groups.get(id);
      assert.ok(g, `${label}: le groupe destructible ${id} des machines est absent du monde`);
      assert.equal(g.colliders.length, 0, `${label}: la machine ${id} porte ${g.colliders.length} colliers solides, sa destruction couperait le couloir`);
    }
  }
});

// Le raccourci qui évite de recalculer la boîte au repos ne doit jamais figer une
// pièce arrêtée par un corps avant son repos. Le corps est tenu hors de la bande
// pendant l'aller de la course, puis entre dans la bande au retour : la lame est
// stoppée sur le corps, avec progress 0. Retiré, le corps doit laisser la lame
// revenir à sa position de repos — sinon sa boîte bloquée continue d'entrer dans
// la collision jusqu'à la course suivante, soit une période entière.
test('un corps dans la bande d arrêt d une lame ne la fige pas hors de son repos', () => {
  const world = FWorld.create(1, 2, { campaign: true, campaignVersion: 2 });
  const { ids } = firstCoupe(world);
  const sim = simWindow.FSimulation.create(world, simOptions());
  const t = sim.state.traps.find(q => ids.includes(q.id) && q.kind === 'blade');
  assert.ok(t, 'la coupe ne pose aucune lame');
  const axis = t.axis, travel = t.travel, key = axis === 'z' ? 'minZ' : 'minX';
  const repos = (axis === 'z' ? t.z - travel : t.x - travel) - (axis === 'z' ? t.d : t.w) / 2;
  const ideal = pr => (axis === 'z' ? t.z - travel * Math.cos(pr * Math.PI * 2) : t.x - travel * Math.cos(pr * Math.PI * 2)) - (axis === 'z' ? t.d : t.w) / 2;
  const retire = () => Object.assign(sim.state.player, { x: world.spawn.x, z: world.spawn.z, y: sim.ground(world.spawn.x, world.spawn.z), hp: 1000, armor: 100 });
  let stoppee = false;
  for (let i = 0; i < 1200; i++) {
    const dansBande = (t.hot && t.progress > .5) || (!t.hot && t.progress > 0);
    const q = axis === 'z' ? { x: t.x + (dansBande ? 0 : 1.2), z: t.z } : { x: t.x, z: t.z + (dansBande ? 0 : 1.2) };
    Object.assign(sim.state.player, { x: q.x, z: q.z, y: sim.ground(q.x, q.z), hp: 1000, armor: 100 });
    for (const e of sim.state.enemies) e.hp = 0;
    sim.step(.025, {});
    if (t.hot && t.box && Math.abs(t.box[key] - ideal(t.progress)) > 1e-6) stoppee = true;
  }
  assert.ok(stoppee, 'le banc ne stoppe aucune lame : il ne prouverait rien');
  let figee = null;
  for (let i = 0; i < 900 && figee === null; i++) {
    retire();
    for (const e of sim.state.enemies) e.hp = 0;
    sim.step(.025, {});
    if (!t.hot && !t.warning && !t.destroyed && t.box && Math.abs(t.box[key] - repos) > 1e-6) figee = t.box[key];
  }
  assert.equal(figee, null, `lame figée à ${figee} au lieu de son repos ${repos} après le départ du corps`);
});

// Le corps qui bloque une lame peut être un ennemi, pas seulement le joueur. Au
// premier pas de repos qui suit la course, la requête spatiale doit encore le voir :
// la lame reste arrêtée sur lui au lieu de le traverser pour rejoindre son repos.
// C'est la garantie du retrait de `actors=hot||warning?trapActors(t):[p]`.
test('une lame au repos ne traverse pas un ennemi encore dans sa bande d arrêt', () => {
  const world = FWorld.create(1, 2, { campaign: true, campaignVersion: 2 });
  const { ids } = firstCoupe(world);
  const sim = simWindow.FSimulation.create(world, simOptions());
  const t = sim.state.traps.find(q => ids.includes(q.id) && q.kind === 'blade');
  assert.ok(t, 'la coupe ne pose aucune lame');
  const e = sim.state.enemies.find(q => q.hp > 0);
  assert.ok(e, 'le monde ne pose aucun ennemi pour le banc');
  const axis = t.axis, travel = t.travel, key = axis === 'z' ? 'minZ' : 'minX';
  const repos = (axis === 'z' ? t.z - travel : t.x - travel) - (axis === 'z' ? t.d : t.w) / 2;
  const keepPlayer = () => Object.assign(sim.state.player, { x: world.spawn.x, z: world.spawn.z, y: sim.ground(world.spawn.x, world.spawn.z), hp: 1000, armor: 100 });
  const holdEnemy = q => { const y = sim.ground(q.x, q.z); Object.assign(e, { x: q.x, z: q.z, y, baseY: y, hp: 1000, armor: 0, vx: 0, vz: 0, speed: 0, attackTime: 0, airborne: false }); };
  const far = axis === 'z' ? { x: t.x + 6, z: t.z } : { x: t.x, z: t.z + 6 };
  let blockedHot = null, restBox = null, inBand = false;
  for (let i = 0; i < 1600 && restBox === null; i++) {
    keepPlayer();
    if (t.hot && t.progress > .5) inBand = true;
    holdEnemy(inBand ? { x: t.x, z: t.z } : far);
    sim.step(.025, {});
    if (t.hot && t.box && Math.abs(t.box[key] - repos) > 1e-6) blockedHot = t.box[key];
    if (blockedHot !== null && !t.hot) restBox = t.box ? t.box[key] : null;
  }
  assert.ok(blockedHot !== null, 'le banc ne stoppe aucune lame sur l ennemi : il ne prouverait rien');
  assert.ok(restBox !== null && Math.abs(restBox - repos) > 1e-6,
    `la lame a traversé l ennemi au repos (boîte ${restBox}, repos ${repos})`);
  // Ennemi retiré : la lame doit alors rejoindre son repos (fix 99596c3).
  let back = null;
  for (let i = 0; i < 900 && back === null; i++) {
    keepPlayer();
    holdEnemy(far);
    sim.step(.025, {});
    if (!t.hot && !t.warning && !t.destroyed && t.box && Math.abs(t.box[key] - repos) < 1e-6) back = t.box[key];
  }
  assert.ok(back !== null, `la lame ne rejoint pas son repos ${repos} après le départ de l ennemi`);
});

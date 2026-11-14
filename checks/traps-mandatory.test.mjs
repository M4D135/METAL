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
for (const seed of seeds) for (const mode of [['classique', {}], ['campagne', { campaign: true }]]) {
  for (const index of mode[0] === 'classique' ? [0, 1, 2] : [0, 3, 6, 9, 12, 17]) {
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

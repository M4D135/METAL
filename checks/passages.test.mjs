// FPassages : la brique générique des passages obligatoires. Elle ne connaît que
// des rectangles, des solides et un graphe de liens : aucun test ici ne parle de
// METAL, de salles ou de pièges. Déterminisme exigé : mêmes entrées, mêmes sorties.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRealm } from '../tools/realm-loader.mjs';

const { window } = loadRealm({ modules: ['fmath', 'passages'] });
const FPassages = window.FPassages;
assert(FPassages, 'src/passages.js doit exposer FPassages');

// Un couloir de 4 × 12 m entre deux salles de 12 × 12, ouvert sur x.
const bounds = { minX: -8, maxX: 8, minZ: -6, maxZ: 6 };
const floors = [
  { minX: -8, maxX: -2, minZ: -6, maxZ: 6, y: 0 },
  { minX: -2, maxX: 2, minZ: -2, maxZ: 2, y: 0 },
  { minX: 2, maxX: 8, minZ: -6, maxZ: 6, y: 0 }
];
const heightAt = (x, z) => floors.find(f => x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ)?.y ?? null;
const gridOf = (solids = []) => FPassages.grid({ bounds, cell: 0.5, heightAt, solidAt: (x, z, y) => solids.some(c => c.minY < y + 1.8 && c.maxY > y && Math.max(c.minX - x, 0, x - c.maxX) ** 2 + Math.max(c.minZ - z, 0, z - c.maxZ) ** 2 <= 0.38 ** 2), radius: 0.38, height: 1.8, step: 0.42 });
const left = { x: -6, z: 0 }, right = { x: 6, z: 0 };

test('la grille couvre les bornes et ne laisse passer que le sol', () => {
  const g = gridOf();
  assert.equal(g.nx, 32); assert.equal(g.nz, 24);
  assert.equal(FPassages.reaches(g, [g.index(left.x, left.z)], right), true);
  const walled = gridOf([{ minX: -0.5, maxX: 0.5, minY: 0, maxY: 3, minZ: -6, maxZ: 6 }]);
  assert.equal(FPassages.reaches(walled, [walled.index(left.x, left.z)], right), false);
});

test('un bloc qui ne couvre pas la hauteur du corps ne barre rien', () => {
  const g = gridOf();
  assert.equal(FPassages.cuts(g, left, right, { minX: -0.4, maxX: 0.4, minY: 2.2, maxY: 3, minZ: -2, maxZ: 2 }), false, 'au-dessus de la tête');
  assert.equal(FPassages.cuts(g, left, right, { minX: -0.4, maxX: 0.4, minY: -1, maxY: -0.2, minZ: -2, maxZ: 2 }), false, 'sous le sol');
});

test('un bloc trop étroit laisse passer, un bloc qui joint les murs barre le passage', () => {
  const g = gridOf();
  assert.equal(FPassages.cuts(g, left, right, { minX: -0.4, maxX: 0.4, minY: 0, maxY: 2, minZ: -2, maxZ: 0.2 }), false, 'on passe à côté');
  assert.equal(FPassages.cuts(g, left, right, { minX: -0.4, maxX: 0.4, minY: 0, maxY: 2, minZ: -2.4, maxZ: 2.4 }), true, 'le couloir est coupé en travers');
});

test('la grille rendue après un test est identique à l’origine', () => {
  const g = gridOf(), before = g.free.slice();
  FPassages.reaches(g, [g.index(left.x, left.z)], right, [{ minX: -0.4, maxX: 0.4, minY: 0, maxY: 2, minZ: -2.4, maxZ: 2.4 }]);
  assert.deepEqual(Array.from(g.free), Array.from(before), 'un test ne doit pas abîmer la grille');
});

test('une marche trop haute sépare deux zones', () => {
  const step = FPassages.grid({ bounds, cell: 0.5, heightAt: (x, z) => (x < 0 ? 0 : 1.2), solidAt: undefined, radius: 0.38, height: 1.8, step: 0.42 });
  assert.equal(FPassages.reaches(step, [step.index(left.x, left.z)], right), false);
  const ramp = FPassages.grid({ bounds, cell: 0.5, heightAt: (x, z) => (x < 0 ? 0 : 0.3), solidAt: undefined, radius: 0.38, height: 1.8, step: 0.42 });
  assert.equal(FPassages.reaches(ramp, [ramp.index(left.x, left.z)], right), true);
});

test('nearestFree rattrape une source posée dans un mur', () => {
  const g = gridOf([{ minX: -6.5, maxX: -5.5, minY: 0, maxY: 3, minZ: -0.5, maxZ: 0.5 }]);
  assert.deepEqual(FPassages.nearestFree(g, { x: -6, z: 0 }, 3).length, 1);
  assert.deepEqual(FPassages.nearestFree(g, { x: 0, z: 5 }, 0.2).length, 0, 'hors du sol praticable, aucune source');
});

test('FPassages distingue un lien obligatoire d un lien de contournement', () => {
  const ring = [{ from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 0 }, { from: 2, to: 3 }];
  assert.deepEqual(FPassages.mandatoryLinks({ links: ring, start: 0, objectives: [3] }), [3]);
  assert.deepEqual(FPassages.mandatoryLinks({ links: ring, start: 0, objectives: [1, 2] }), [], 'un anneau n a aucun passage obligatoire');
  assert.deepEqual(FPassages.mandatoryLinks({ links: ring, start: 0, objectives: [9] }), [], 'cible hors du graphe : aucun lien forcé');
});

test('la tournée gloutonne rend les liens réellement empruntés', () => {
  const links = [
    { from: 0, to: 1, x1: 0, z1: 0, x2: 10, z2: 0 },
    { from: 1, to: 2, x1: 10, z1: 0, x2: 20, z2: 0 },
    { from: 0, to: 2, x1: 0, z1: 0, x2: 20, z2: 0 }
  ];
  assert.deepEqual(FPassages.tourLinks({ links, start: 0, objectives: [2] }), [2], 'le lien direct est le plus court');
  assert.deepEqual(FPassages.tourLinks({ links, start: 0, objectives: [1, 2] }), [0, 1]);
  assert.deepEqual(FPassages.tourLinks({ links, start: 0, objectives: [] }), []);
});

test('deux appels sur les mêmes entrées rendent exactement le même résultat', () => {
  const links = [{ from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3 }, { from: 3, to: 0 }, { from: 1, to: 3 }];
  const a = FPassages.mandatoryLinks({ links, start: 0, objectives: [2] }), b = FPassages.mandatoryLinks({ links, start: 0, objectives: [2] });
  assert.deepEqual(a, b);
  const g = gridOf();
  assert.deepEqual(Array.from(FPassages.flood(g, [g.index(left.x, left.z)])), Array.from(FPassages.flood(g, [g.index(left.x, left.z)])));
});

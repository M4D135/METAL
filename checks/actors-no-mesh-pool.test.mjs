// Non-régression du revert de T17 [RCPU-11] : aucun réservoir de maillages d'acteurs.
// Le réservoir faisait vivre les maillages d'une image à l'autre (promotion en vieille
// génération, barrières d'écriture) et mesh() = meshInto({}, …) remplaçait un littéral à
// 28 propriétés par 28 ajouts séquentiels : mesure appariée 1,33 en isolé et models()
// 1,13 au niveau du jeu. Voir docs/chantier-moteur/preuves/lot-05-rendu-cpu/t17/revert.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {FRender} from './mesh-fixture.mjs';

const scope = {window: {FRender}};
vm.runInNewContext(readFileSync(new URL('../src/actors.js', import.meta.url), 'utf8'), scope);
const {build} = scope.window.FActors;

const entity = type => ({id: 7, type, hp: type === 3 ? 30 : 5, x: 2, z: -3, baseY: 0, y: 1.35, yaw: 0,
  moveSpeed: 1.5, awareness: 'engage', attackState: 'idle', stun: 0, hurt: 0, windup: 0, aimX: 2, aimY: 1.45, aimZ: -25});
const options = {time: 2.5, phase: .7, blend: .8, distance: 4, quality: 'auto', backend: 'webgl2'};

test('le moteur n expose plus de constructeur de maillage sur objet fourni', () => {
  assert.equal(FRender.meshInto, undefined, 'meshInto est revenu : le chemin réservé de T17 est de retour');
});

test('FActors.build ne recycle aucun maillage ni aucune position d un appel a l autre', () => {
  const pool = [];
  const a = build(entity(1), {...options, pool});
  const b = build(entity(1), {...options, pool});
  assert.ok(a.length > 0 && b.length > 0, 'aucun maillage produit');
  const vus = new Set(a);
  for (const m of b) assert.equal(vus.has(m), false, 'un maillage a ete recycle entre deux builds');
  const positions = new Set(a.map(m => m.p));
  for (const m of b) assert.equal(positions.has(m.p), false, 'le tableau de position a ete recycle entre deux builds');
});

test('FActors.build ne retient rien du tableau passe par l appelant', () => {
  const pool = [];
  build(entity(2), {...options, pool});
  assert.equal(pool.length, 0, 'le reservoir de l appelant a ete rempli : T17 est de retour');
});

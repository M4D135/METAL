// RESTE-03 : le constructeur unique de maillage dynamique et ses formes canoniques.
// Le gain visé est une seule classe cachée par liste dynamique ; ce test fige la forme
// du littéral, la neutralité de ses valeurs par défaut, et l'absence de clé ajoutée par
// les producteurs (actors, effects, modèles du jeu).
import test from 'node:test';
import assert from 'node:assert/strict';
import {FRenderMesh} from './mesh-fixture.mjs';
import {makeScene} from '../tools/proof/render-scene.mjs';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const CANON = Object.keys(FRenderMesh('box', [0, 0, 0], [1, 1, 1], 0, [0, 0, 0], 0));

test('le constructeur renvoie toujours les mêmes clés, dans le même ordre', () => {
  assert.ok(CANON.length >= 26, 'le littéral doit porter tous les champs lus par le moteur');
  for (let i = 0; i < 60; i++) {
    const m = FRenderMesh('sphere', [1, 2, 3], [.5, .5, .5], 4, [.1, .2, .3], .7);
    assert.deepEqual([...Object.keys(m)], CANON);
    assert.equal(m.shape, 'sphere');
    assert.deepEqual([...m.p], [1, 2, 3]);
    assert.deepEqual([...m.s], [.5, .5, .5]);
    assert.equal(m.mat, 4);
    assert.deepEqual([...m.r], [.1, .2, .3]);
    assert.equal(m.emissive, .7);
  }
  const bare = FRenderMesh('box', [0, 0, 0], [1, 1, 1], 0);
  assert.deepEqual([...Object.keys(bare)], CANON);
  assert.deepEqual([...bare.r], [0, 0, 0]);
  assert.equal(bare.emissive, 0);
});

test('les valeurs par défaut se lisent exactement comme un champ absent', () => {
  const m = FRenderMesh('box', [0, 0, 0], [1, 1, 1], 0);
  for (const key of ['color', 'surface', 'outdoor', 'alpha', 'additive', 'actorPart', 'actorScale',
    'debrisId', 'sourceId', 'material', 'fxPriority', 'ground', 'innerRatio', 'region']) {
    assert.equal(key in m, true, key + ' doit être une propriété présente');
    assert.equal(m[key], undefined, key + ' doit valoir undefined');
  }
  for (const key of ['overlay', 'fx', 'structural', 'fxFire', 'fxSmoke', 'fxSpark']) {
    assert.equal(m[key], false, key + ' doit être faux par défaut');
  }
  assert.equal(m.actorLod, 0);
  assert.equal(m.effectPart, '');
  // Le repli Canvas2D distingue ground absent (détection automatique) et ground false.
  assert.equal(JSON.stringify({g: m.ground}), JSON.stringify({}), 'ground doit rester undefined, jamais false');
});

test('aucun producteur n\'ajoute de clé au littéral canonique', () => {
  for (const world of [['camp', 6], ['legacy', 0]]) {
    const scene = makeScene(root, {world, seed: 96, quality: 'auto', content: false});
    let seen = 0;
    for (let i = 0; i < 90; i++) {
      const frame = scene.frame(1 / 60, {time: false});
      for (const m of frame.dynamic || []) {
        assert.deepEqual([...Object.keys(m)], CANON, world.join(':') + ' image ' + i + ' maillage ' + m.shape + '/' + (m.actorPart || m.effectPart || ''));
        seen++;
      }
    }
    assert.ok(seen > 5000, world.join(':') + ' doit produire des maillages dynamiques (' + seen + ')');
    scene.renderer.dispose?.();
  }
});

// Banc lot 05 T8 [RESTE-03] : vérification structurelle du constructeur de maillage unique.
// Ce que T8 affirme n'est pas d'abord un temps, c'est que tous les maillages dynamiques
// partagent UNE seule classe cachée, en représentation rapide, créée complète (aucune clé
// ajoutée après coup). Cette vérification est robuste là où le micro-bench de pack() est
// contaminé par la comparaison croisée de deux moteurs dans le même isolate.
// usage: node --allow-natives-syntax tools/proof/lot05/mesh-shape.mjs <racine> [images=120] [monde=camp:17]
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';

const root = resolve(process.argv[2] || '.');
const frames = +(process.argv[3] || 120), spec = process.argv[4] || 'camp:17';
let hasFast, sameMap;
try {
  hasFast = vm.runInThisContext('(m) => %HasFastProperties(m)', {filename: 'natives'});
  sameMap = vm.runInThisContext('(a, b) => %HaveSameMap(a, b)', {filename: 'natives'});
} catch (e) {
  console.error('Ce banc exige node --allow-natives-syntax : ' + e.message);
  process.exit(2);
}
const {makeScene} = await import(pathToFileURL(root + '/tools/proof/render-scene.mjs').href);
const S = makeScene(root, {world: [spec.split(':')[0], +spec.split(':')[1]], seed: 96, quality: 'auto'});
for (let i = 0; i < 60; i++) S.frame(1 / 60, {time: false});
const vus = new Map();
let maillages = 0, rapides = 0, avecCleAjoutee = 0, pairesComparees = 0, memesMaps = 0;
const CHAMPS = ['shape', 'p', 's', 'mat', 'r', 'emissive', 'color', 'surface', 'overlay', 'fx', 'alpha', 'additive',
  'outdoor', 'actorPart', 'actorLod', 'actorScale', 'structural', 'debrisId', 'sourceId', 'material', 'effectPart',
  'fxFire', 'fxSmoke', 'fxSpark', 'fxPriority', 'ground', 'innerRatio', 'region'];
let reference = null;
for (let i = 0; i < frames; i++) {
  for (const m of S.frame(1 / 60, {time: false}).dynamic) {
    maillages++;
    if (hasFast(m)) rapides++;
    const cle = m.shape + '|' + Object.keys(m).join(',');
    vus.set(cle, (vus.get(cle) || 0) + 1);
    if (Object.keys(m).length !== CHAMPS.length) avecCleAjoutee++;
    if (!reference) reference = m;
    else { pairesComparees++; if (sameMap(reference, m)) memesMaps++; }
  }
}
S.renderer.dispose?.();
const formes = [...new Set([...vus.keys()].map(k => k.split('|')[0]))].sort();
console.log(JSON.stringify({
  banc: 'node --allow-natives-syntax tools/proof/lot05/mesh-shape.mjs <racine> <images> <monde>',
  racine: root, monde: spec, images: frames, node: process.version,
  maillagesObserves: maillages,
  enRepresentationRapide: rapides, partRepresentationRapide: +(rapides / maillages).toFixed(4),
  avecCleAjouteeApresCreation: avecCleAjoutee,
  formes: formes.length, formesListe: formes,
  formesDeClassesCachees: vus.size,
  pairesCompareesALaReference: pairesComparees, memesClassesCachees: memesMaps,
  partMemeClasseCachee: pairesComparees ? +(memesMaps / pairesComparees).toFixed(4) : null,
}, null, 1));

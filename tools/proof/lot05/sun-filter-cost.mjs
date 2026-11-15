// Sonde de la piste écartée n°2 de l'étape « au-delà » du lot 05 : réutiliser le jeu de
// projeteurs du soleil d'une image à l'autre au lieu de le filtrer à chaque image.
// usage: node tools/proof/lot05/sun-filter-cost.mjs <racine> [images=300] [monde=camp:17] [qualite=auto] [reps=5]
//
// 1. `sonde`   : coût de la boucle de filtrage (instrumentation 'sun-sonde'), nombre de
//    candidats examinés et de projeteurs retenus par image, et fréquence à laquelle le jeu
//    obtenu change d'une image à l'autre — c'est la fréquence à laquelle un jeu réutilisé
//    serait périmé, donc l'artefact d'« apparition retardée » refusé par la fiche.
// 2. `apparié` : gain maximal de la piste, prototype 'sun-reutilise' (filtre non rejoué)
//    contre le code de la racine, deux scènes en lockstep, ordre inversé à chaque image,
//    exécution de contrôle même racine contre elle-même.
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {instrumentFile} from '../../render/lot05-instrument.mjs';

const root = resolve(process.argv[2] || '.');
const frames = +(process.argv[3] || 300), spec = process.argv[4] || 'camp:17';
const quality = process.argv[5] || 'auto';
const reps = Math.max(2, +(process.argv[6] || 5));
const world = [spec.split(':')[0], +spec.split(':')[1]];
const {makeScene} = await import(pathToFileURL(root + '/tools/proof/render-scene.mjs').href);

const scene = (sources, record = false) => makeScene(root, {world, seed: 96, quality, content: false, record, sources});

// 1. sonde : coût du filtre et péremption du jeu entre deux images
globalThis.__sun = {ms: 0, candidats: 0, projeteurs: 0, gens: [], images: 0};
let S = scene({renderer: instrumentFile(root, 'sun-sonde')});
for (let i = 0; i < 90; i++) S.frame(1 / 60, {time: false});
globalThis.__sun = {ms: 0, candidats: 0, projeteurs: 0, gens: [], images: 0};
let drawMs = 0;
for (let i = 0; i < frames; i++) drawMs += S.frame(1 / 60, {time: true}).drawMs;
const sun = globalThis.__sun;
let changes = 0;
for (let i = 1; i < sun.gens.length; i++) if (sun.gens[i] !== sun.gens[i - 1]) changes++;
const sonde = {images: sun.images, msFiltreParImage: +(sun.ms / sun.images).toFixed(4),
  candidatsExaminesParImage: +(sun.candidats / sun.images).toFixed(1),
  projeteursRetenusParImage: +(sun.projeteurs / sun.images).toFixed(1),
  partFiltreDansDraw: +(sun.ms / drawMs).toFixed(4),
  drawP50Ms: null, imagesOuLeJeuChange: changes, partImagesPerimees: +(changes / Math.max(1, sun.gens.length - 1)).toFixed(4)};
S.renderer.dispose(); S.sim.dispose();

// 2. apparié : code de la racine contre prototype « jeu réutilisé »
const base = {}, proto = {};
for (let r = 0; r < reps; r++) {
  const scenes = [scene({}), scene({renderer: instrumentFile(root, 'sun-reutilise')})];
  for (let i = 0; i < 90; i++) { for (const s of scenes) s.frame(1 / 60, {time: false}); }
  for (let i = 0; i < frames; i++) {
    const order = (i & 1) ? [0, 1] : [1, 0];
    for (const j of order) {
      globalThis.__sunReuseOn = j === 1;
      const f = scenes[j].frame(1 / 60, {time: true});
      (j === 0 ? base : proto)[`d${r}_${i}`] = f.drawMs;
    }
  }
  for (const s of scenes) s.renderer.dispose();
}
globalThis.__sunReuseOn = false;
const A = Object.values(base), B = Object.values(proto);
const median = a => { const v = a.slice().sort((x, y) => x - y); return v[Math.floor(v.length / 2)]; };
const paires = A.map((v, i) => B[i] / v).sort((x, y) => x - y);

// contrôle : même racine contre elle-même, même mécanique
const cA = {}, cB = {};
for (let r = 0; r < reps; r++) {
  const scenes = [scene({}), scene({})];
  for (let i = 0; i < 90; i++) for (const s of scenes) s.frame(1 / 60, {time: false});
  for (let i = 0; i < frames; i++) {
    const order = (i & 1) ? [0, 1] : [1, 0];
    for (const j of order) {
      globalThis.__sunReuseOn = j === 1;
      const f = scenes[j].frame(1 / 60, {time: true});
      (j === 0 ? cA : cB)[`d${r}_${i}`] = f.drawMs;
    }
  }
  for (const s of scenes) s.renderer.dispose();
}
const CA = Object.values(cA), CB = Object.values(cB);
const brut = median(B) / median(A), controle = median(CB) / median(CA);

console.log(JSON.stringify({
  banc: 'node tools/proof/lot05/sun-filter-cost.mjs <racine> <images> <monde> <qualite> <reps>',
  racine: root, monde: spec, qualite: quality, images: frames, reps, node: process.version,
  sonde,
  apparie: {drawP50Base: +median(A).toFixed(4), drawP50Prototype: +median(B).toFixed(4),
    ratioBrut: +brut.toFixed(4), ratioControle: +controle.toFixed(4),
    ratioCorrige: +(brut / controle).toFixed(4),
    ratioParPaire: +paires[Math.floor(paires.length / 2)].toFixed(4),
    echantillons: A.length},
  lecture: 'le gain maximal de la piste est la borne basse du ratio corrigé : il doit être '
    + 'confronté à la part d images où le jeu réutilisé serait périmé (sonde.partImagesPerimees).'
}, null, 1));

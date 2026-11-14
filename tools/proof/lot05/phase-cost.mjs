// Sonde « au-delà » du lot 05 : répartition du temps de draw() par étape.
// Le renderer est instrumenté à la volée par tools/render/lot05-instrument.mjs (aucune
// copie du moteur n'est conservée) : les compteurs sont posés sur draw() à des ancres
// exactes et la sonde échoue si le code a bougé.
// usage: node tools/proof/lot05/phase-cost.mjs <racine> [images=300] [monde=camp:17] [qualite=auto]
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {instrumentFile} from '../../render/lot05-instrument.mjs';

const root = resolve(process.argv[2] || '.');
const frames = +(process.argv[3] || 300), spec = process.argv[4] || 'camp:17';
const quality = process.argv[5] || 'auto';
globalThis.__ph = {};
const {makeScene} = await import(pathToFileURL(root + '/tools/proof/render-scene.mjs').href);
const S = makeScene(root, {world: [spec.split(':')[0], +spec.split(':')[1]], seed: 96, quality, content: false,
  sources: {renderer: instrumentFile(root, 'phases')}});
for (let i = 0; i < 90; i++) S.frame(1 / 60, {time: false});
globalThis.__ph = {};
let drawMs = 0;
for (let i = 0; i < frames; i++) drawMs += S.frame(1 / 60, {time: true}).drawMs;
const ph = globalThis.__ph, out = {};
for (const k of Object.keys(ph)) out[k] = +(ph[k] / frames).toFixed(3);
out.total = +(drawMs / frames).toFixed(3);
out.sommeEtapes = +Object.values(out).reduce((a, b) => a + b, 0).toFixed(3);
console.log(JSON.stringify({banc: 'node tools/proof/lot05/phase-cost.mjs <racine> <images> <monde> <qualite>',
  racine: root, monde: spec, qualite: quality, images: frames, node: process.version, msParImage: out}, null, 1));

// Sonde DRAW-08 : cellules testées, cellules rejetées, entrées touchées par la requête de vue.
// Le renderer est instrumenté à la volée (variante « t19-sonde » de tools/render/lot05-instrument.mjs).
// usage: node tools/proof/lot05/cell-sonde.mjs <racine> [images=300] [monde=camp:6] [qualite=auto]
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {instrumentFile} from '../../render/lot05-instrument.mjs';

const root = resolve(process.argv[2] || '.');
const frames = +(process.argv[3] || 300), spec = process.argv[4] || 'camp:6';
const quality = process.argv[5] || 'auto';
globalThis.__t19 = {cellsTested: 0, cellsSkipped: 0, entriesTouched: 0, entriesSkipped: 0};
const {makeScene} = await import(pathToFileURL(root + '/tools/proof/render-scene.mjs').href);
const S = makeScene(root, {world: [spec.split(':')[0], +spec.split(':')[1]], seed: 96, quality, canvas2d: true, content: false,
  sources: {renderer: instrumentFile(root, 't19-sonde')}});
for (let i = 0; i < 60; i++) S.frame(1 / 60, {time: false});
const c = globalThis.__t19, before = {...c};
for (let i = 0; i < frames; i++) S.frame(1 / 60, {time: false});
const d = {cellsTested: c.cellsTested - before.cellsTested, cellsSkipped: c.cellsSkipped - before.cellsSkipped,
  entriesTouched: c.entriesTouched - before.entriesTouched, entriesSkipped: c.entriesSkipped - before.entriesSkipped};
console.log(JSON.stringify({monde: spec, qualite: quality, images: frames,
  cellulesTesteesParImage: +(d.cellsTested / frames).toFixed(1),
  cellulesRejeteesParImage: +(d.cellsSkipped / frames).toFixed(1),
  partCellulesRejetees: +(d.cellsSkipped / d.cellsTested).toFixed(4),
  entreesToucheesParImage: +(d.entriesTouched / frames).toFixed(1),
  entreesEviteesParImage: +(d.entriesSkipped / frames).toFixed(1),
  partEntreesEvitees: +(d.entriesSkipped / d.entriesTouched).toFixed(4)}));

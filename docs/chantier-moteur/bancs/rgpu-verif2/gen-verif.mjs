// RGPU-verif : page autonome (file://) qui mesure les variantes du renderer SANS le jeu :
// monde réel (FWorld/FSimulation), scènes rejouées (capture extérieure de l'autre agent + scène
// intérieure synthétique), débit pipeliné (blocs de 10 images, une seule synchro) et latence
// (synchro par image), écarts d'image et coût d'une réallocation des cibles (gouverneur).
// Usage : node gen-verif.mjs <racine-ferro> <scene.json> <config.json> <sortie.html>
import {readFileSync, writeFileSync} from 'node:fs';
import {build} from '../rgpu/patches.mjs';
const [root, scenePath, cfgPath, outPath] = process.argv.slice(2);
const C = JSON.parse(readFileSync(cfgPath, 'utf8'));
const src = n => readFileSync(root + '/src/' + n, 'utf8');
const base = src('renderer.js');
const codes = [...new Set(C.variants.map(v => v.code).filter(c => c !== 'base'))];
const variantScripts = codes.map(name => {
  const c = build(base, name).replace('window.FRender={create,foliageTriangles};', `window.__V[${JSON.stringify(name)}]={create};`);
  if (c.toLowerCase().includes('</script')) throw new Error('script tag');
  return `<script>${c}</script>`;
}).join('\n');
const mods = ['renderer.js', 'world.js', 'destruction.js', 'economy.js', 'brain.js', 'simulation.js'].map(n => `<script>${src(n)}</script>`).join('\n');
const scene = readFileSync(scenePath, 'utf8');
if (scene.toLowerCase().includes('</script')) throw new Error('scene tag');
const run = readFileSync(new URL('./' + (C.runFile || 'vrun.js'), import.meta.url), 'utf8');
const html = `<!doctype html><html><head><meta charset="utf-8"><title>rgpu-verif</title>
<style>html,body{margin:0;background:#000}canvas{position:absolute;left:0;top:0}</style></head><body>
<script>window.__V={};window.__CFG=${JSON.stringify(C)};window.__SCENE=${scene};</script>
${mods}
${variantScripts}
<script>${run}</script></body></html>`;
writeFileSync(outPath, html);
console.log('wrote', outPath, html.length, 'bytes; codes', codes.join(','));

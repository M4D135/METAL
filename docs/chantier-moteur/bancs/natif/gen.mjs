// NATIF : page autonome (file://) qui mesure le renderer de FERRO v0.2 (copie locale 248043a) sans le jeu,
// a des resolutions imposees (tampon = taille CSS x ratio), sur plusieurs mondes de METAL 0.8 (lecture seule).
// Usage : node gen.mjs <config.json> <sortie.html>
import {readFileSync, writeFileSync} from 'node:fs';
import {build} from './npatches.mjs';
const METAL = (process.env.METAL_ROOT||process.cwd());
const HERE = new URL('./', import.meta.url).pathname;
const [cfgPath, outPath] = process.argv.slice(2);
const C = JSON.parse(readFileSync(cfgPath, 'utf8'));
const src = n => readFileSync(METAL + '/src/' + n, 'utf8');
const base = readFileSync(HERE + 'ferro-renderer-248043a.js', 'utf8');
const codes = [...new Set(C.variants.map(v => v.code))];
const variantScripts = codes.map(name => {
  const c = build(base, name).replace('window.FRender={create,foliageTriangles};', `window.__V[${JSON.stringify(name)}]={create};`);
  if (c.toLowerCase().includes('</script')) throw new Error('script tag');
  return `<script>${c}</script>`;
}).join('\n');
if (base.toLowerCase().includes('</script')) throw new Error('script tag base');
const mods = `<script>${base}</script>\n` + ['world.js', 'destruction.js', 'economy.js', 'brain.js', 'simulation.js'].map(n => `<script>${src(n)}</script>`).join('\n');
let scene = '[]';
if (C.scenes.some(s => s.kind === 'capture' || s.kind === 'calm')) {
  scene = readFileSync(HERE + '../rgpu/out/scene-w0.json', 'utf8');
  if (scene.toLowerCase().includes('</script')) throw new Error('scene tag');
}
const run = readFileSync(HERE + (C.runFile || 'run.js'), 'utf8');
const html = `<!doctype html><html><head><meta charset="utf-8"><title>natif</title>
<style>html,body{margin:0;background:#000;overflow:hidden}canvas{position:absolute;left:0;top:0}</style></head><body>
<script>window.__V={};window.__CFG=${JSON.stringify(C)};window.__SCENE=${scene};</script>
${mods}
${variantScripts}
<script>${run}</script></body></html>`;
writeFileSync(outPath, html);
console.log('wrote', outPath, html.length, 'bytes; codes', codes.join(','));

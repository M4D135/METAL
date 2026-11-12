// RGPU : génère une page de jeu instrumentée (copie locale, ferro/ n'est jamais modifié).
// node gen.mjs <racine-ferro> <config.json> <sortie.html>
// La page assemble index.html + style.css + modules (ordre de tools/build.py) comme build.py,
// ajoute un script PRE (capture rAF, devicePixelRatio, contextes WebGL, variantes de rendu)
// et un script POST (pilote déterministe : clavier/souris synthétiques, mesures, sortie JSON).
import {readFileSync, writeFileSync} from 'node:fs';
import {build} from './patches.mjs';
const [root, configPath, outPath] = process.argv.slice(2);
const C = JSON.parse(readFileSync(configPath, 'utf8'));
const src = n => readFileSync(root + '/src/' + n, 'utf8');
const modules = ['renderer.js','world.js','destruction.js','music.js','audio.js','soundscape.js','economy.js','brain.js','simulation.js','motion.js','actors.js','effects.js','options.js','game.js'];
const code = modules.map(src).join('\n;\n');
const version = JSON.parse(readFileSync(root + '/package.json', 'utf8')).version;
const baseRenderer = src('renderer.js');
const codes = [...new Set(C.variants.map(v => v.code))];
const variantScripts = codes.map(name => {
  const c = build(baseRenderer, name).replace('window.FRender={create,foliageTriangles};', `window.__RGPU_CODE[${JSON.stringify(name)}]={create,foliageTriangles};`);
  if (c.toLowerCase().includes('</script')) throw new Error('script tag in variant');
  return `<script>${c}</script>`;
}).join('\n');
const pre = readFileSync(new URL('./pre.js', import.meta.url), 'utf8');
const post = readFileSync(new URL('./post.js', import.meta.url), 'utf8');
let html = src('index.html');
html = html.replace('/*__STYLE__*/', () => src('style.css') + `\n#app{width:${C.cssW}px!important;height:${C.cssH}px!important;right:auto!important;bottom:auto!important}`);
html = html.replace('<script>/*__CODE__*/</script>', () =>
  `<script>window.__RGPU_CONFIG=${JSON.stringify(C)};</script>\n<script>${pre}</script>\n${variantScripts}\n<script>${code}</script>\n<script>${post}</script>`);
html = html.replaceAll('__GAME_VERSION__', version);
writeFileSync(outPath, html);
console.log('wrote', outPath, html.length, 'bytes; codes', codes.join(','));

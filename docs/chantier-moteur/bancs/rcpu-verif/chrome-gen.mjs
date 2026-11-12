// Page de jeu instrumentee pour Chrome sans interface (file://, aucun port) : reutilise les scripts PRE/POST
// du banc RGPU (lecture seule) mais avec les variantes du prototype RCPU (proto.mjs) pour mesurer
// le cout CPU REEL de draw() (vrais appels WebGL2/Metal) et le cout GPU (readPixels 1x1 apres chaque draw).
// node chrome-gen.mjs <ferro> <config.json> <out.html>
import {readFileSync,writeFileSync} from 'node:fs';
import {patchRenderer} from '../rcpu/proto.mjs';
const [root,configPath,outPath]=process.argv.slice(2);
const C=JSON.parse(readFileSync(configPath,'utf8'));
const src=n=>readFileSync(root+'/src/'+n,'utf8');
const modules=['renderer.js','world.js','destruction.js','music.js','audio.js','soundscape.js','economy.js','brain.js','simulation.js','motion.js','actors.js','effects.js','options.js','game.js'];
const code=modules.map(src).join('\n;\n');
const version=JSON.parse(readFileSync(root+'/package.json','utf8')).version;
const base=src('renderer.js');
const FLAGS={exact:{grid:true,sun:true,cache:false,pool:true},sun:{grid:false,sun:true,cache:false,pool:false},grid:{grid:true,sun:false,cache:false,pool:false},
  cache:{grid:false,sun:false,cache:true,pool:false},all:{grid:true,sun:true,cache:true,pool:true},pool:{grid:false,sun:false,cache:false,pool:true}};
const codes=[...new Set(C.variants.map(v=>v.code))].filter(c=>c!=='base');
const scripts=codes.map(name=>{const f=FLAGS[name];if(!f)throw new Error('unknown variant '+name);
  const c=patchRenderer(base,f).replace('window.FRender={create,foliageTriangles};',`window.__RGPU_CODE[${JSON.stringify(name)}]={create,foliageTriangles};`);
  if(c.toLowerCase().includes('</script'))throw new Error('script tag');return `<script>${c}</script>`;}).join('\n');
const RG=new URL('../rgpu/',import.meta.url);
const pre=readFileSync(new URL('pre.js',RG),'utf8'),post=readFileSync(new URL('post.js',RG),'utf8');
let html=src('index.html');
html=html.replace('/*__STYLE__*/',()=>src('style.css')+`\n#app{width:${C.cssW}px!important;height:${C.cssH}px!important;right:auto!important;bottom:auto!important}`);
html=html.replace('<script>/*__CODE__*/</script>',()=>`<script>window.__RGPU_CONFIG=${JSON.stringify(C)};</script>\n<script>${pre}</script>\n${scripts}\n<script>${code}</script>\n<script>${post}</script>`);
html=html.replaceAll('__GAME_VERSION__',version);
writeFileSync(outPath,html);console.log('wrote',outPath,html.length,'bytes; codes',codes.join(','));

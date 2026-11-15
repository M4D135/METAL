// RCPU: GC pressure attributable to the render path. Run with: node --trace-gc gc-bench.mjs <root> <frames> <world> <full|simonly>
// Prints per-run totals; parse the --trace-gc lines with gc-parse.py.
import {makeScene} from '../render-scene.mjs';
import {readFileSync} from 'node:fs';
import {patchRenderer} from '../../../docs/chantier-moteur/bancs/rcpu/proto.mjs';
const root=process.argv[2],frames=+(process.argv[3]||3600),[kind,idx]=(process.argv[4]||'camp:6').split(':'),mode=process.argv[5]||'full',proto=process.argv[6]==='proto';
const S=makeScene(root,{world:[kind,+idx],content:false,record:false,sources:proto?{renderer:patchRenderer(readFileSync(root+'/src/renderer.js','utf8'),{grid:true,sun:true,cache:true,pool:true})}:{}});
if(mode==='drawonly'){S.sim.step=()=>{};S.game.models=(()=>{const keep=S.game.models;let cached=null;return (...a)=>cached||(cached=keep(...a));})();}
// "drawcall" isole renderer.draw() : simulation figee, models() memoisee, lumieres et
// ressorts de presentation figes. Ce qui est alloue entre START et END appartient au rendu.
if(mode==='drawcall'||mode==='drawnone'){
  S.sim.step=()=>{};
  const keep=S.game.models;let cached=null;S.game.models=(...a)=>cached||(cached=keep(...a));
  const lum=S.win.FEffects.lights;let lc=null;S.win.FEffects.lights=()=>lc||(lc=lum(S.sim.state));
  const vue={height:0,roll:0,fov:0};S.motion.update=()=>vue;if(S.leftMotion)S.leftMotion.update=()=>vue;
  // "drawnone" est le plancher du banc : meme scene, draw() vide. Ce qu'il reste est ce
  // que le banc lui-meme alloue par image, et doit etre retire a la mesure de drawcall.
  if(mode==='drawnone')S.renderer.draw=()=>{};
}
const s=S.sim.state;
// "simonly" still runs the simulation and destruction sync, but skips models() and draw().
if(mode==='simonly'){S.game.models=()=>[];S.renderer.draw=()=>{};}
if(mode==='renderonly'){S.sim.step=()=>{};}
for(let i=0;i<120;i++)S.frame(1/60,{tour:true});
console.log('### START');
const t=performance.now();
for(let i=0;i<frames;i++)S.frame(1/60,{tour:true});
console.log('### END',mode,proto?'proto':'original',frames,'frames',(performance.now()-t).toFixed(0),'ms');

S.sim.dispose();S.renderer.dispose();

// RCPU: GC pressure attributable to the render path. Run with: node --trace-gc gc-bench.mjs <root> <frames> <world> <full|simonly>
// Prints per-run totals; parse the --trace-gc lines with gc-parse.py.
import {scene} from './harness.mjs';
const root=process.argv[2],frames=+(process.argv[3]||3600),[kind,idx]=(process.argv[4]||'camp:6').split(':'),mode=process.argv[5]||'full',proto=process.argv[6]==='proto';
const S=scene(root,{world:[kind,+idx],wrap:false,proto:proto?{grid:true,sun:true,cache:true,pool:true}:null});
if(mode==='drawonly'){S.sim.step=()=>{};S.game.models=(()=>{const keep=S.game.models;let cached=null;return (...a)=>cached||(cached=keep(...a));})();}
const s=S.sim.state;
// "simonly" still runs the simulation and destruction sync, but skips models() and draw().
if(mode==='simonly'){S.game.models=()=>[];S.renderer.draw=()=>{};}
if(mode==='renderonly'){S.sim.step=()=>{};}
for(let i=0;i<120;i++)S.frame(1/60,{tour:true});
console.log('### START');
const t=performance.now();
for(let i=0;i<frames;i++)S.frame(1/60,{tour:true});
console.log('### END',mode,proto?'proto':'original',frames,'frames',(performance.now()-t).toFixed(0),'ms');

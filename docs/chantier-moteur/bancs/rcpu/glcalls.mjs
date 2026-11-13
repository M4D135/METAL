// RCPU: GL call mix per frame (fake GL counters), tour scenario.
import {scene,GLC,resetGL} from './harness.mjs';
const root=process.argv[2],frames=+(process.argv[3]||1500),[kind,idx]=(process.argv[4]||'camp:17').split(':');
const S=scene(root,{world:[kind,+idx],wrap:false});
for(let i=0;i<120;i++)S.frame(1/60,{tour:true});resetGL();
for(let i=0;i<frames;i++)S.frame(1/60,{tour:true});
console.log('world',kind+':'+idx,Object.fromEntries(Object.entries(GLC).map(([k,v])=>[k,+(v/frames).toFixed(1)])));

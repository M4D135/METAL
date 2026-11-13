// Hash chain per scene (state hashed every 50 steps). Compare the printed line between processes and JIT tiers.
import {SCENES} from './scenes.mjs';
const PLAN={stack10:+(process.argv[2]||300),pyramid55:+(process.argv[2]||300),rubble300:+(process.argv[3]||500),blast200:+(process.argv[3]||500)};
const out=[];
for(const [name,steps] of Object.entries(PLAN)){const {w}=SCENES[name]({});let chain=2166136261;
  for(let i=0;i<steps;i++){if(name==='blast200'&&i===240)w.explode(0,.5,0,14,900);w.step(1/120,1);if(i%50===49){for(const c of w.hash())chain=Math.imul(chain^c.charCodeAt(0),16777619);}}
  out.push(name+':'+(chain>>>0).toString(16)+'/'+w.hash());}
console.log(out.join(' '));

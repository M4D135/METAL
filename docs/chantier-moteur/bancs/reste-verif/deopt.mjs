// Steady-state deoptimisations of the full frame chain (R1 build). usage: node --trace-deopt deopt.mjs | node deoptsum.mjs
import {scene} from './scene.mjs';
const S=scene({variant:'r1',world:['camp',6]});for(let i=0;i<600;i++)S.frame();console.log('### STEADY');for(let i=0;i<900;i++)S.frame();console.log('### END');

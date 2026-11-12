// Share of enemies whose displacement is exactly zero at simulation.js:1804 (moveSpeed=hypot(dx,dz)/dt for ALL enemies).
// For those, hypot(+-0,+-0)/dt === +0, so `dx===0&&dz===0?0:Math.hypot(dx,dz)/dt` is bit-identical and skips the builtin.
import {loadFast} from './fast.mjs';import {SCENARIOS,drive,makeInput,build,mean} from './lib.mjs';
const OLD="if(dt>0)for(let i=0;i<s.enemies.length;i++)s.enemies[i].moveSpeed=Math.hypot(s.enemies[i].x-starts[i][0],s.enemies[i].z-starts[i][1])/dt;";
const NEW="if(dt>0)for(let i=0;i<s.enemies.length;i++){const __dx=s.enemies[i].x-starts[i][0],__dz=s.enemies[i].z-starts[i][1];globalThis.__tc++;if(__dx===0&&__dz===0)globalThis.__zc++;s.enemies[i].moveSpeed=Math.hypot(__dx,__dz)/dt;}";
const ctx=loadFast({patches:{simulation:[[OLD,NEW]]}});
for(const [label,idx,opts] of SCENARIOS){const {sim}=build(ctx,idx,opts),s=sim.state,input=makeInput();globalThis.__tc=0;globalThis.__zc=0;const n=[],alive=[];
  for(let i=0;i<1800;i++){drive(i,input,s);sim.step(1/60,input);s.events.length=0;n.push(s.enemies.length);alive.push(s.enemies.filter(e=>!e.dead&&e.hp>0).length);if(s.dead)break;}
  console.log(label.padEnd(13)+' enemies/step '+mean(n).toFixed(0)+' (alive '+mean(alive).toFixed(0)+') | zero-displacement share at :1804 = '+(100*__zc/__tc).toFixed(1)+'% of '+(__tc/n.length).toFixed(0)+' hypot calls/step');}

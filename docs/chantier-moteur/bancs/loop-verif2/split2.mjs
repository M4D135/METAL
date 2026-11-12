// LOOP-05 : comparaison appariée par tranches de 0,1 s simulée, trois simulations en parallèle dans le même
// processus (1x60, 2x120, 1x40), ordre tournant. Médiane des ratios par tranche : robuste à la charge.
import {loadFast,mkWorld,INPUTS} from './fast.mjs';
const [label='campaign-9',secs='30',pat='a']=process.argv.slice(2);
const W=loadFast();const {FSimulation,FBrain}=W,input=INPUTS[pat];
const opts=label.startsWith('classic')?{armorSystem:true,inventory:{weapons:[true,true,true],ammo:[180,36,12]}}:{armorSystem:true};
const world=mkWorld(W,label);const mk=()=>FSimulation.create(world,{...opts,brain:FBrain.create({mode:'cpu'})});
const V=[['1x60',6],['2x120',12],['1x40',4],['1x30',3]].map(([name,n])=>({name,n,dt:.1/n,sim:mk(),t:0,ms:[]}));
{const w=mk();for(let i=0;i<1200;i++){w.step(1/120,input(i/120));w.state.player.hp=Math.max(w.state.player.hp,60);}const w2=mk();for(let i=0;i<600;i++){w2.step(1/40,input(i/40));w2.state.player.hp=Math.max(w2.state.player.hp,60);}}
const chunks=Math.round(+secs/.1);
for(let c=0;c<chunks;c++){for(let k=0;k<V.length;k++){const v=V[(k+c)%V.length];const t0=process.hrtime.bigint();for(let i=0;i<v.n;i++){v.sim.step(v.dt,input(v.t));v.sim.state.player.hp=Math.max(v.sim.state.player.hp,60);v.t+=v.dt;}v.ms.push(Number(process.hrtime.bigint()-t0)/1e6);}}
const med=a=>[...a].sort((x,y)=>x-y)[a.length>>1],q=(a,p)=>[...a].sort((x,y)=>x-y)[Math.floor(a.length*p)];
const base=V[0];
for(const v of V){const ratios=v.ms.map((x,i)=>x/base.ms[i]);const trim=a=>{const s=[...a].sort((x,y)=>x-y);return s.slice(0,Math.floor(s.length*.9)).reduce((x,y)=>x+y,0);};
  console.log(label,v.name.padEnd(6),'tranche 0,1 s : médiane',med(v.ms).toFixed(3),'ms | ratio médian par tranche',med(ratios).toFixed(3),'[q25',q(ratios,.25).toFixed(2),'q75',q(ratios,.75).toFixed(2)+']','| ratio des sommes (90 % les moins chères)',(trim(v.ms)/trim(base.ms)).toFixed(3),'| ratio des médianes',(med(v.ms)/med(base.ms)).toFixed(3));}

// LOOP-05 (contre-vérif, domaine principal) : coût CPU (process.cpuUsage, robuste à la charge) de
// 1 pas de 1/60, 2 pas de 1/120, 1 pas de 1/40 par seconde simulée. Rejeux alternés.
import {loadFast,mkWorld,INPUTS} from './fast.mjs';
const [label='campaign-9',secs='20',reps='4',pat='a']=process.argv.slice(2);
const W=loadFast();const {FSimulation,FBrain}=W,input=INPUTS[pat];
const opts=label.startsWith('classic')?{armorSystem:true,inventory:{weapons:[true,true,true],ammo:[180,36,12]}}:{armorSystem:true};
const world=mkWorld(W,label);
function run(dt){const sim=FSimulation.create(world,{...opts,brain:FBrain.create({mode:'cpu'})}),s=sim.state;let t=0,n=0;const per=[];const c0=process.cpuUsage();
  while(t<+secs&&!s.dead&&!s.won){const a=performance.now();sim.step(dt,input(t));per.push(performance.now()-a);s.player.hp=Math.max(s.player.hp,60);t+=dt;n++;}
  const c=process.cpuUsage(c0);per.sort((x,y)=>x-y);return {cpu:(c.user+c.system)/1000/t,med:per[n>>1],p25:per[n>>2],n,t,alive:s.enemies.filter(e=>e.hp>0).length,rev:s.destructionRevision};}
const S={'1x60':1/60,'2x120':1/120,'1x40':1/40,'1x30':1/30};const acc={};for(const k in S)acc[k]={cpu:[],med:[],p25:[]};
for(const k in S)run(S[k]);// chauffe
for(let r=0;r<+reps;r++){const order=r%2?Object.keys(S).reverse():Object.keys(S);for(const k of order){const o=run(S[k]);acc[k].cpu.push(o.cpu);acc[k].med.push(o.med);acc[k].p25.push(o.p25);acc[k].info=o;}}
const med=a=>[...a].sort((x,y)=>x-y)[a.length>>1],min=a=>Math.min(...a);
const base=acc['1x60'];
for(const k in S){const a=acc[k],perSec=1/S[k];
  console.log(label,k.padEnd(6),'CPU ms/s simulée: médiane',med(a.cpu).toFixed(1),'min',min(a.cpu).toFixed(1),'| pas médian µs',(med(a.med)*1000).toFixed(0),'=> ms/s (médian×pas/s)',(med(a.med)*perSec).toFixed(1),
   '| ratio CPU vs 1x60: méd',(med(a.cpu)/med(base.cpu)).toFixed(2),'min',(min(a.cpu)/min(base.cpu)).toFixed(2),'| ratio pas médian',(med(a.med)*perSec/(med(base.med)*60)).toFixed(2),'| révisions',a.info.rev,'vivants',a.info.alive);}

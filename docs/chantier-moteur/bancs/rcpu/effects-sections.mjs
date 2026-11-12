// RCPU: FEffects.build cost by section (effects.js line markers), tour scenario.
// usage: node effects-sections.mjs <ferroRoot> [frames=3000] [world=camp:17]
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {scene} from './harness.mjs';
const root=process.argv[2],frames=+(process.argv[3]||3000),[kind,idx]=(process.argv[4]||'camp:17').split(':');
const S=scene(root,{world:[kind,+idx],wrap:false});
const L=readFileSync(root+'/src/effects.js','utf8').split('\n');
const marks=[48,91,106,144,172,184,188,192,193,200],names={12:'bossAttacks',48:'traps',91:'pipes (close+sort)',106:'explosions',144:'projectiles',172:'debris scan',184:'sort #1',188:'represented Set',192:'sort #2',193:'slice+solid',200:'return'};
const expect={12:'if(!state)return []',48:'for(const trap of state.traps',91:'for(const pipe of close(state.pipes',106:'const blasts=close(',144:'const trails=[];',172:'const wreckage=[]',184:'wreckage.sort(order);',188:'const represented=new Set();',192:'wreckage.sort(order);',193:'for(const {q,p,s,raw,structural,age} of wreckage.slice(0,debrisBudget))',200:'return out;'};
for(const [n,t] of Object.entries(expect))if(!L[n-1].includes(t))throw new Error('effects.js line '+n+' changed');
L[11]='__ER();'+L[11];for(const n of marks)L[n-1]='__E('+n+');'+L[n-1];
const acc=new Map();let last=0,cur=12;
const __ER=()=>{last=performance.now();cur=12;},__E=n=>{const t=performance.now();acc.set(cur,(acc.get(cur)||0)+t-last);last=t;cur=n;};
const W={};vm.runInThisContext('(function(window,__E,__ER){'+L.join('\n')+'\n})',{filename:'effects-i.js'})(W,__E,__ER);
S.win.FEffects.build=W.FEffects.build;
let n=0,debris=0,pipes=0,traps=0;
for(let i=0;i<frames+120;i++){if(i===120)acc.clear();S.frame(1/60,{tour:true});if(i>=120){n++;const s=S.sim.state;debris+=(s.debris||[]).length;pipes+=(s.pipes||[]).length;traps+=(s.traps||[]).length;}}
console.log('world',kind+':'+idx,'frames',n,'avg state.debris',(debris/n).toFixed(0),'pipes',(pipes/n).toFixed(0),'traps',(traps/n).toFixed(0));
let total=0;for(const v of acc.values())total+=v;
for(const [k,v] of [...acc].sort((a,b)=>b[1]-a[1]))console.log(String(k).padStart(4),(names[k]||'').padEnd(22),(v/n*1000).toFixed(1).padStart(7),'us/frame',(100*v/total).toFixed(0).padStart(3)+'%');
console.log('total',(total/n*1000).toFixed(1),'us/frame');

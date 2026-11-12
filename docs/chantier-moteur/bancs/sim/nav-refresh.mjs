// What a full nav refresh (refreshNav after any destruction/door) actually changes, vs a dirty-rectangle refresh.
import {loadFast} from './fast.mjs';import {SCENARIOS,build,drive,makeInput} from './lib.mjs';
const P={simulation:[
 ['solids=destruction.colliders;seenDestructionRevision=destruction.revision;','{const __old=solids;solids=destruction.colliders;__NR.acc.push(...__NR.diff(__old,solids));}seenDestructionRevision=destruction.revision;'],
 ['    function refreshNav(reset=true){\n','    function refreshNav(reset=true){\n      if(reset&&__NR.on){if(!__NR.shadow||__NR.shadow.length!==nav.length)__NR.shadow=Uint8Array.from(nav);const t0=performance.now();let changed=0,inside=0,dirty=0;const ch=__NR.acc.splice(0);const doorsNow=doorBoxes.map(q=>({...q}));const all=ch.concat(__NR.doors?__NR.doorDiff(__NR.doors,doorsNow):[]);__NR.doors=doorsNow;\n        for(let i=0;i<nav.length;i++){const [x,z]=coord(i),v=blocked(x,z,.4,ground(x,z),doorBoxes,solids,[])?0:1,inRect=all.some(q=>x>=q.minX-.4-1e-6&&x<=q.maxX+.4+1e-6&&z>=q.minZ-.4-1e-6&&z<=q.maxZ+.4+1e-6);if(inRect)dirty++;if(v!==__NR.shadow[i]){changed++;if(inRect)inside++;else if(__NR.out.length<5)__NR.out.push([x,z,v]);}__NR.shadow[i]=v;}\n        __NR.log.push({step:__NR.step,cells:nav.length,changed,inside,dirty,boxes:all.length,ms:performance.now()-t0});}\n'],
]};
globalThis.__NR={on:true,log:[],acc:[],out:[],shadow:null,step:0,doors:null,
 diff(a,b){const key=q=>q.minX+','+q.maxX+','+q.minY+','+q.maxY+','+q.minZ+','+q.maxZ,c=new Map();for(const q of a){const k=key(q);c.set(k,(c.get(k)||0)+1);}const out=[];for(const q of b){const k=key(q),n=c.get(k);if(n)c.set(k,n-1);else out.push(q);}for(const q of a){const k=key(q),n=c.get(k);if(n>0){c.set(k,n-1);out.push(q);}}return out;},
 doorDiff(a,b){const out=[];for(let i=0;i<b.length;i++)if(!a[i]||a[i].minY!==b[i].minY||a[i].maxY!==b[i].maxY)out.push(b[i]);return out;}};
const ctx=loadFast({patches:P});
for(const [label,idx,opts] of SCENARIOS){
  __NR.log=[];__NR.doors=null;__NR.acc=[];__NR.shadow=null;__NR.out=[];const {sim}=build(ctx,idx,opts),s=sim.state,input=makeInput();if(process.env.WEAPON)input.weapon=+process.env.WEAPON;let pendingSteps=0,maxPending=0;
  for(let i=0;i<1800;i++){__NR.step=i;drive(i,input,s);sim.step(1/60,input);s.events.length=0;if(s.aiStats.navPending>0)pendingSteps++;maxPending=Math.max(maxPending,s.aiStats.navPending||0);if(s.dead)break;}
  const L=__NR.log;console.log(label+': full refreshes '+L.length+', steps with pending nav work '+pendingSteps+'/1800, max pending '+maxPending);
  for(const r of L.slice(0,10))console.log('   step '+r.step+' cells '+r.cells+' changed '+r.changed+' (inside dirty rect '+r.inside+') dirty-rect cells '+r.dirty+' changed boxes '+r.boxes);
  const tot=L.reduce((a,r)=>a+r.changed,0),ins=L.reduce((a,r)=>a+r.inside,0),dc=L.reduce((a,r)=>a+r.dirty,0),cells=L.reduce((a,r)=>a+r.cells,0);
  console.log('   TOTAL enqueued '+cells+' | really changed '+tot+' | all changed inside dirty rects: '+(tot===ins)+' | dirty-rect cells '+dc+' ('+(100*dc/Math.max(1,cells)).toFixed(2)+'% of the work)');
}

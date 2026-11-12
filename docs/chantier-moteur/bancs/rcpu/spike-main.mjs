import {readFileSync} from 'node:fs'; import vm from 'node:vm'; import inspector from 'node:inspector';
const root=process.argv[2], target=+process.argv[3]||620; const W={};
for(const n of ['renderer','world','destruction','economy','brain','simulation'])vm.runInThisContext('(function(window){'+readFileSync(root+'/src/'+n+'.js','utf8')+'\n})',{filename:n+'.js'})(W);
const {FWorld,FSimulation,FBrain}=W; const w=FWorld.create(96,0); const sim=FSimulation.create(w,{brain:FBrain.create({mode:'cpu'})});
const s=sim.state,input={moveX:0,moveY:1,sprint:true,fire:false,lookX:0,lookY:0};
const session=new inspector.Session(); session.connect();
const post=(m,p)=>new Promise((res,rej)=>session.post(m,p,(e,r)=>e?rej(e):res(r)));
await post('Profiler.enable'); await post('Profiler.setSamplingInterval',{interval:100});
let profile=null;
for(let i=0;i<1800;i++){
  input.moveX=Math.sin(i/90); input.fire=(i%20)<6; input.dash=(i%240)===0; s.player.yaw+=0.01;
  if(i===target)await post('Profiler.start');
  const t0=performance.now(); sim.step(1/60,input); const d=performance.now()-t0;
  if(i===target){profile=(await post('Profiler.stop')).profile; console.log('step',i,'ms',d.toFixed(1));break;}
}
const nodes=new Map(profile.nodes.map(n=>[n.id,n])); const self=new Map();
profile.samples.forEach((id,k)=>self.set(id,(self.get(id)||0)+profile.timeDeltas[k]));
const parent=new Map(); for(const n of profile.nodes)for(const c of n.children||[])parent.set(c,n.id);
const incl=new Map();
for(const [id,t] of self){const seen=new Set();let cur=id;while(cur!==undefined){const cf=nodes.get(cur).callFrame,key=(cf.functionName||'(anon)')+' '+cf.url.split('/').pop()+':'+(cf.lineNumber+1);if(!seen.has(key)){seen.add(key);incl.set(key,(incl.get(key)||0)+t);}cur=parent.get(cur);}}
const tot=[...self.values()].reduce((a,b)=>a+b,0);
console.log('INCLUSIVE');for(const [k,t] of [...incl].sort((a,b)=>b[1]-a[1]).slice(0,16))console.log((t/1000).toFixed(1)+'ms',k);

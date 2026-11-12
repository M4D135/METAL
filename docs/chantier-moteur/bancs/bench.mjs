import {readFileSync} from 'node:fs'; import vm from 'node:vm';
const root=process.argv[2]; const ctx={window:{},performance,console,Math,Date}; vm.createContext(ctx);
for(const n of ['renderer','world','destruction','economy','brain','simulation'])vm.runInContext(readFileSync(root+'/src/'+n+'.js','utf8'),ctx,{filename:n+'.js'});
const {FWorld,FSimulation,FBrain}=ctx.window;
const ms=(f)=>{const t=performance.now();const r=f();return [r,performance.now()-t];};
const out={};
for(const [label,idx,opts] of [['legacy-s0',0,undefined],['legacy-s2',2,undefined],['campaign-w10',9,{campaign:true}],['campaign-w16',15,{campaign:true}]]){
  let w,t; [w,t]=ms(()=>FWorld.create(96,idx,opts)); const gen=t;
  let brain=null; try{brain=FBrain.create({mode:'cpu'});}catch(e){}
  let sim; [sim,t]=ms(()=>FSimulation.create(w,{brain})); const simInit=t;
  const times=[]; const input={moveX:0,moveY:1,sprint:true,fire:false,lookX:0,lookY:0};
  const s=sim.state; let enemiesAlive=0;
  for(let i=0;i<1800;i++){ // 30 s a 60 Hz
    input.moveX=Math.sin(i/90); input.fire=(i%20)<6; input.dash=(i%240)===0;
    s.player.yaw+=0.01; const t0=performance.now(); sim.step(1/60,input); times.push(performance.now()-t0);
    if(s.dead){break;}
  }
  times.sort((a,b)=>a-b); const q=p=>times[Math.min(times.length-1,Math.floor(times.length*p))];
  out[label]={worldGenMs:+gen.toFixed(1),simInitMs:+simInit.toFixed(1),steps:times.length,avgMs:+(times.reduce((a,b)=>a+b,0)/times.length).toFixed(3),p95:+q(.95).toFixed(3),p99:+q(.99).toFixed(3),max:+times[times.length-1].toFixed(2),meshes:w.meshes.length,colliders:w.colliders.length,enemies:w.enemies.length,active:s.enemies.filter(e=>e.hp>0&&e.deployed!==false).length};
}
console.log(JSON.stringify(out,null,1));

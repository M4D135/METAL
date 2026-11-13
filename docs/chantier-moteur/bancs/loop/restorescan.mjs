// Balayage : part des points de reprise (pris comme game.js:94-98, joueur au sol) refusés par restore().
// node restorescan.mjs <ferro> [secondes]
import {readFileSync} from 'node:fs';import vm from 'node:vm';import {performance} from 'node:perf_hooks';
const [root,secs='30']=process.argv.slice(2);const ctx={window:{},performance,console,Math,Date};vm.createContext(ctx);
for(const n of ['renderer','world','destruction','economy','brain','simulation']){let src=readFileSync(root+'/src/'+n+'.js','utf8');
  if(n==='simulation'){const a="require=condition=>{if(!condition)throw new Error('Invalid checkpoint');};";src=src.replace(a,"require=condition=>{if(!condition){const e=new Error('Invalid checkpoint');globalThis.__fail=((e.stack.split('\\n')[2]||'').match(/simulation\\.js:(\\d+)/)||[])[1];throw e;}};");}
  vm.runInContext(src,ctx,{filename:n+'.js'});}
const {FWorld,FSimulation,FBrain}=ctx.window;
const list=process.env.QUICK?[['classic-0',0],['campaign-0',0,{campaign:true,campaignVersion:2}],['campaign-10',10,{campaign:true,campaignVersion:2}]]:[['classic-0',0],['classic-1',1],['classic-2',2],...[0,2,4,6,8,10,12,14,16,17].map(i=>['campaign-'+i,i,{campaign:true,campaignVersion:2}])];
const rows=[];
for(const [label,idx,opts] of list){
  const world=FWorld.create(96,idx,opts);const o={armorSystem:true,...(opts?{}:{inventory:{weapons:[true,true,true],ammo:[180,36,12]}})};
  const sim=FSimulation.create(world,{...o,brain:FBrain.create({mode:'cpu'})});const s=sim.state;let t=0,tries=0,fails=0,first=null,rescued=0,softRescued=0,softOk=0;const lines=new Map();
  const inputAt=t=>({moveX:Math.sin(t*.667),moveY:1,sprint:true,fire:(t%.333)<.1,dash:false,weapon:opts?undefined:Math.floor(t/6)%3,lookX:.01,lookY:0});
  while(t<+secs&&!s.dead&&!s.won){
    for(let i=0;i<180||s.player.airborne;i++){sim.step(1/60,inputAt(t));s.player.hp=Math.max(s.player.hp,60);t+=1/60;if(s.dead)break;}
    if(s.dead)break;tries++;ctx.__fail=null;
    const fresh=FSimulation.create(world,{...o,brain:FBrain.create({mode:'cpu'})});
    const snap=JSON.parse(JSON.stringify(sim.snapshot()));
    if(!fresh.restore(snap,{recover:true})){fails++;first??=+t.toFixed(1);lines.set(ctx.__fail,(lines.get(ctx.__fail)||0)+1);
      const lite=JSON.parse(JSON.stringify(snap));lite.state.rubble=[];const again=FSimulation.create(world,{...o,brain:FBrain.create({mode:'cpu'})});if(again.restore(lite,{recover:true}))rescued++;
      else{ // débris au repos seulement remis en mouvement (resting:false) au lieu d'être retirés
        const soft=JSON.parse(JSON.stringify(snap));for(const q of soft.state.rubble)if(q.resting){q.resting=false;}const third=FSimulation.create(world,{...o,brain:FBrain.create({mode:'cpu'})});if(third.restore(soft,{recover:true}))softRescued++;}
      {const soft=JSON.parse(JSON.stringify(snap));for(const q of soft.state.rubble)if(q.resting){q.resting=false;}const third=FSimulation.create(world,{...o,brain:FBrain.create({mode:'cpu'})});if(third.restore(soft,{recover:true}))softOk++;}}
  }
  rows.push({monde:label,essais:tries,refusés:fails,'repris sans débris':rescued,'repris débris non posés':softOk,'premier refus (s)':first,'ligne simulation.js':[...lines].map(([l,n])=>l+'×'+n).join(' '),rubble:s.debris?.filter?.(q=>q.structural).length??'?',destructions:sim.destruction?.revision});
}
console.table(rows);

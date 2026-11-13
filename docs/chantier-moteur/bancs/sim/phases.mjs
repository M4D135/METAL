// Inclusive time per subsystem (main realm), mean per step and breakdown of the worst steps.
// Args: [scenario|all] [weapon] [steps]
import vm from 'node:vm';import {source,MODULES,SCENARIOS,drive,makeInput,build,mean} from './lib.mjs';
const only=process.argv[2]||'all',weapon=process.argv[3]!==undefined&&process.argv[3]!=='-'?+process.argv[3]:undefined,steps=+process.argv[4]||1800;
const TOP=['updateShield','syncDestruction','updateSystems','pumpNav','updateDirector','updateEnvironment','locomote','fire','updateTrophies','updateEnemies','updateBossAttacks','updateProjectiles','updateHazards','collectSupplies','checkPlayerBounds'];
const INNER=['updateEncounters','encounterCounts','plan','setGoal','route','perceive','separate','updateBrain','updateDebris','explode','damageScenery','refreshNav','rebuildCollision','unsupportedBodies','rebuildNeighbors','navigate','hitRay','castProjectile'];
function wrap(src,names){for(const name of names){const sig='function '+name+'(',at=src.indexOf(sig);if(at<0)throw new Error(name);src=src.slice(0,at)+'function '+name+'__raw('+src.slice(at+sig.length);src=src.slice(0,at)+'function '+name+'(){const __t=performance.now();try{return '+name+'__raw.apply(undefined,arguments);}finally{__PH["'+name+'"]+=performance.now()-__t;}}\n'+src.slice(at);}return src;}
globalThis.__PH={};for(const n of [...TOP,...INNER])__PH[n]=0;
const win={};globalThis.window=win;for(const n of MODULES){let src=source(n);if(n==='simulation')src=wrap(src,[...TOP,...INNER]);vm.runInThisContext(src,{filename:n+'.js'});}delete globalThis.window;
const ctx={window:win};
for(const [label,idx,opts] of SCENARIOS){
  if(only!=='all'&&label!==only)continue;
  const {sim}=build(ctx,idx,opts);const s=sim.state,input=makeInput();if(weapon!==undefined)input.weapon=weapon;
  const rows=[];for(let i=0;i<steps;i++){drive(i,input,s);for(const k in __PH)__PH[k]=0;const t=performance.now();sim.step(1/60,input);const total=performance.now()-t;
    rows.push({i,total,ph:{...__PH},debris:s.debris.length,moving:s.debris.filter(q=>!q.resting&&(q.structural||q.age<q.life)).length,navPending:s.aiStats.navPending||0,ev:s.events.map(e=>e.name).filter((n,j,a)=>a.indexOf(n)===j).join(',')});s.events.length=0;if(s.dead)break;}
  const m=k=>mean(rows.map(r=>r.ph[k]));const tot=mean(rows.map(r=>r.total));
  console.log('== '+label+' steps '+rows.length+' mean step '+tot.toFixed(3)+' ms');
  console.log('  mean ms/step: '+[...TOP,...INNER].map(k=>[k,m(k)]).filter(([,v])=>v>.002).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+' '+v.toFixed(3)+' ('+(100*v/tot).toFixed(0)+'%)').join(' | '));
  for(const r of rows.slice().sort((a,b)=>b.total-a.total).slice(0,6))console.log('  step '+r.i+' '+r.total.toFixed(2)+' ms debris '+r.debris+' moving '+r.moving+' navPending '+r.navPending+' :: '+Object.entries(r.ph).filter(([,v])=>v>.15).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+' '+v.toFixed(2)).join(', ')+' :: ev '+r.ev.slice(0,120));
}

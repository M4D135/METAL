// Phase timing of sim.step on the cumulative R1 build (main realm): sequential marks, each interval goes to the label of the mark that closes it.
// usage: node phases.mjs [steps]   env SCEN
import {loadAll,simSource,SCENARIOS,build,drive,makeInput,rep} from './build.mjs';
const N=+(process.argv[2]||3000);
const ids=new Map(),names=[];let last=0;const cur=new Float64Array(64),calls=new Float64Array(64);
export const H=k=>{const t=performance.now();let id=ids.get(k);if(id===undefined){id=names.length;ids.set(k,id);names.push(k);}cur[id]+=t-last;calls[id]++;last=t;};
export const PH=[
 ['      dt=Number.isFinite(dt)?clamp(dt,0,.05):0;if(s.won||s.dead||checkPlayerBounds())return;\n      syncArmor();','      __H("-");dt=Number.isFinite(dt)?clamp(dt,0,.05):0;if(s.won||s.dead||checkPlayerBounds())return;\n      syncArmor();'],
 ['      updateShield(dt,input);syncDestruction();updateSystems(dt);pumpNav();updateDirector(dt);updateEnvironment(dt);if(checkPlayerBounds())return;if(input.interact&&!interactHeld)interact();interactHeld=!!input.interact;',
  '      __H("step.head");updateShield(dt,input);__H("updateShield");syncDestruction();__H("syncDestruction");updateSystems(dt);__H("updateSystems");pumpNav();__H("pumpNav+bake");updateDirector(dt);__H("updateDirector");updateEnvironment(dt);__H("updateEnvironment");if(checkPlayerBounds())return;if(input.interact&&!interactHeld)interact();interactHeld=!!input.interact;'],
 ["      locomote(dt,arsenal&&s.equipment.left==='shield'?{...input,dash:false}:input);if(checkPlayerBounds())return;checkPad(p);\n      if(input.melee)melee();\n      if(input.fire)fire(input.assist);",
  "      __H('interact/pulse');locomote(dt,arsenal&&s.equipment.left==='shield'?{...input,dash:false}:input);if(checkPlayerBounds())return;checkPad(p);__H('locomote');\n      if(input.melee)melee();\n      if(input.fire)fire(input.assist);__H('fire');"],
 ['      updateTrophies(dt);refreshAdaptation();updateEnemies(dt);updateBossAttacks(dt);updateProjectiles(dt);if(checkPlayerBounds())return;\n      for(const bullet of s.bullets){',
  '      __H("fireLeft/navWait");updateTrophies(dt);__H("updateTrophies");refreshAdaptation();__H("refreshAdaptation");updateEnemies(dt);__H("enemies.tail(updateBrain)");updateBossAttacks(dt);__H("updateBossAttacks");updateProjectiles(dt);__H("projectiles.rest");if(checkPlayerBounds())return;\n      for(const bullet of s.bullets){'],
 ['      s.bullets=s.bullets.filter(q=>q.life>0);\n      updateHazards();if(s.dead)return;','      s.bullets=s.bullets.filter(q=>q.life>0);__H("bullets");\n      updateHazards();__H("updateHazards");if(s.dead)return;'],
 ['      collectSupplies();\n      for(const q of s.particles){','      collectSupplies();__H("cores+supplies");\n      for(const q of s.particles){'],
 ['      s.particles=s.particles.filter(q=>q.life>0);\n      s.bossAlive=s.enemies.some(e=>e.type===3&&e.hp>0);','      s.particles=s.particles.filter(q=>q.life>0);__H("particles");\n      s.bossAlive=s.enemies.some(e=>e.type===3&&e.hp>0);'],
 ["&&!s.dead){s.won=true;s.score+=500;stopMotion();emit('win');}\n    }","&&!s.dead){s.won=true;s.score+=500;stopMotion();emit('win');}__H('step.tail');\n    }"],
 // updateEnemies
 ['routeBudget=advanced?2:Infinity;routeSearches=routeDeferred=0;updateEncounters(dt);rebuildNeighbors();if(enemyStarts.length','routeBudget=advanced?2:Infinity;routeSearches=routeDeferred=0;__H("enemies.pre");updateEncounters(dt);__H("updateEncounters");rebuildNeighbors();__H("rebuildNeighbors#1");if(enemyStarts.length'],
 ['starts[2*i]=s.enemies[i].x;starts[2*i+1]=s.enemies[i].z;}\n      for(const e of s.enemies){','starts[2*i]=s.enemies[i].x;starts[2*i+1]=s.enemies[i].z;}__H("enemies.starts");\n      for(const e of s.enemies){'],
 ['if(!e.sleeping&&e.senseWait<=0){e.senseWait+=.15;perceive(e);sensed=true;}','if(!e.sleeping&&e.senseWait<=0){e.senseWait+=.15;__H("enemies.loop");perceive(e);__H("perceive");sensed=true;}'],
 ['if(e.thinkWait<=0){e.thinkWait+=.65+(e.id%3)*.05;plan(e);}','if(e.thinkWait<=0){e.thinkWait+=.65+(e.id%3)*.05;__H("enemies.loop");plan(e);__H("plan");}'],
 ["        e.attackState=e.cooldown>0?'recover':'idle';navigate(e,dt);\n      }\n      for(const e of s.enemies)if(alive(e))checkPad(e);\n      rebuildNeighbors();separate(dt);",
  "        e.attackState=e.cooldown>0?'recover':'idle';__H('enemies.loop');navigate(e,dt);__H('navigate');\n      }\n      __H('enemies.loop');for(const e of s.enemies)if(alive(e))checkPad(e);__H('enemies.checkPad');\n      rebuildNeighbors();__H('rebuildNeighbors#2');separate(dt);__H('separate');"],
 ['st.pathSearches=routeSearches;st.pathDeferred=routeDeferred;}if(progression)encounterCounts();','st.pathSearches=routeSearches;st.pathDeferred=routeDeferred;}__H("enemies.moveSpeed+stats");if(progression)encounterCounts();__H("encounterCounts");'],
 [`\n      updateDebris(dt);`,`\n      __H("projectiles.pre");updateDebris(dt);__H("updateDebris");`],
];
if(import.meta.url===`file://${process.argv[1]}`){
  // Robust attribution on a loaded machine: the deterministic scenario is replayed K times and, for every
  // (phase, step), the MINIMUM duration over the K replays is kept (preemption only ever adds time).
  const K=+process.env.K||3;
  let src=simSource({});for(const [a,b] of PH)src=rep(src,a,b,'phase');
  const win=loadAll({sim:src,names:['renderer','world','destruction','economy','brain','simulation'],hooks:{__H:H}});
  const tot=new Float64Array(64),cnt=new Float64Array(64);let steps=0,stepMin=0,stepRaw=0;const stepMins=[];
  for(const [label,idx,opts] of SCENARIOS){if(process.env.SCEN&&!process.env.SCEN.split(',').includes(label))continue;
    const best=[],bestStep=new Float64Array(N).fill(Infinity),callSum=new Float64Array(64);
    for(let r=0;r<K;r++){const {sim}=build(win,idx,opts),s=sim.state,input=makeInput();
      for(let i=0;i<N;i++){drive(i,input,s);if(s.player.hp<50)s.player.hp=100;cur.fill(0);calls.fill(0);const t=performance.now();last=t;sim.step(1/60,input);const d=performance.now()-t;s.events.length=0;
        if(d<bestStep[i])bestStep[i]=d;if(r===K-1)stepRaw+=i>=300?d:0;
        for(let k=0;k<names.length;k++){if(!best[k])best[k]=new Float64Array(N).fill(Infinity);if(cur[k]<best[k][i])best[k][i]=cur[k];if(r===0&&i>=300)callSum[k]+=calls[k];}}}
    for(let k=0;k<names.length;k++){if(!best[k])continue;for(let i=300;i<N;i++)if(best[k][i]<Infinity)tot[k]+=best[k][i];cnt[k]+=callSum[k];}
    for(let i=300;i<N;i++){stepMin+=bestStep[i];stepMins.push(bestStep[i]);}steps+=N-300;
  }
  let sumAcc=0;for(let k=0;k<names.length;k++)sumAcc+=tot[k];stepMins.sort((a,b)=>a-b);
  console.log('steps',steps,'K',K,'| mean step (min of K) us',(1e3*stepMin/steps).toFixed(1),'| raw last run us',(1e3*stepRaw/steps).toFixed(1),'| sum of phase minima us',(1e3*sumAcc/steps).toFixed(1),'| p50',(1e3*stepMins[steps>>1]).toFixed(0),'p99',(1e3*stepMins[Math.floor(steps*.99)]).toFixed(0),'max',(1e3*stepMins[steps-1]).toFixed(0));
  for(const k of names.map((n,i)=>i).sort((a,b)=>tot[b]-tot[a]))console.log((100*tot[k]/sumAcc).toFixed(1).padStart(6)+'% '+(1e3*tot[k]/steps).toFixed(2).padStart(8)+' us/step  calls/step '+(cnt[k]/steps).toFixed(2).padStart(6)+'  '+names[k]);
}

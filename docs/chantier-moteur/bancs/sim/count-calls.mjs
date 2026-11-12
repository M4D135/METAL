// Counts calls per step for hot helpers and attributes them to parent function and step phase.
import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {ROOT,MODULES,SCENARIOS,drive,makeInput,build,q,mean} from './lib.mjs';
import {wrapFunctions,tracker} from './instrument.mjs';
const NAMES=['step','updateShield','syncDestruction','updateSystems','pumpNav','updateDirector','updateEnvironment','interact','locomote','checkPad','melee','fire','fireArsenal','updateTrophies','updateEnemies','updateBossAttacks','updateProjectiles','updateHazards','collectSupplies','checkPlayerBounds',
 'updateEncounters','encounterCounts','safeEntry','perceive','plan','navigate','separate','setGoal','route','nearestNode','segmentFree','sight','ray','hitRay','castProjectile','projectileVictim','updateDebris','debrisFloor','debrisSupport','debrisSweep','debrisBoxes','move','support','blocked','ground','airMove','landingAt','explode','blastExposure','damageScenery','hear','remember','reactToShot','nearby','rebuildNeighbors','unsupportedBodies','tickBoss','updateBrain','cover','peek','canShoot','barrel','attack','burst','beneathTerrain','fallbackLanding','actorBlocked','returnToPost','clearLane','trapPose','refreshNav','playerMuzzle','launchRocket'];
const only=process.argv[2],steps=+process.argv[3]||1800,weapon=process.argv[4]!==undefined?+process.argv[4]:undefined;
for(const [label,idx,opts] of SCENARIOS){
  if(only&&only!=='all'&&label!==only)continue;
  const T=tracker();const ctx={window:{},performance,console,Math,Date,__T:T};vm.createContext(ctx);
  for(const n of MODULES){let src=readFileSync(ROOT+'/src/'+n+'.js','utf8');if(n==='simulation')src=wrapFunctions(src,NAMES);vm.runInContext(src,ctx,{filename:n+'.js'});}
  const {sim,world}=build(ctx,idx,opts);T.counts.clear();T.parents.clear();T.phases.clear();T.perStep.clear();T.cur.clear();T.step=0;
  const s=sim.state,input=makeInput();if(weapon!==undefined)input.weapon=weapon;
  let maxDebris=0,sumDebris=0,maxBullets=0,maxProj=0,n=0;
  for(let i=0;i<steps;i++){drive(i,input,s);sim.step(1/60,input);s.events.length=0;T.endStep();n++;maxDebris=Math.max(maxDebris,s.debris.length);sumDebris+=s.debris.length;maxBullets=Math.max(maxBullets,s.bullets.length);maxProj=Math.max(maxProj,s.projectiles.length);if(s.dead)break;}
  for(const a of T.perStep.values())while(a.length<T.step)a.push(0);
  console.log('== '+label+' steps '+n+' floors '+world.walkable.length+' colliders '+world.colliders.length+' enemies '+world.enemies.length+' traps '+(world.traps||[]).length+' debris max '+maxDebris+' avg '+(sumDebris/n).toFixed(1)+' bullets max '+maxBullets+' projectiles max '+maxProj);
  const rows=[...T.perStep].map(([k,a])=>[k,mean(a),q(a,.5),q(a,.99),Math.max(...a)]).sort((a,b)=>b[1]-a[1]);
  console.log('  calls/step: name mean p50 p99 max');
  for(const r of rows.slice(0,30))console.log('   '+r[0].padEnd(20)+r[1].toFixed(1).padStart(9)+String(r[2]).padStart(7)+String(r[3]).padStart(8)+String(r[4]).padStart(8));
  for(const fn of ['ground','blocked','ray','segmentFree','debrisFloor','sight']){
    const tot=(T.perStep.get(fn)||[]).reduce((a,b)=>a+b,0);if(!tot)continue;
    const par=[...T.parents].filter(([k])=>k.startsWith(fn+' <- ')).sort((a,b)=>b[1]-a[1]).slice(0,10);
    console.log('  '+fn+' by parent: '+par.map(([k,v])=>k.slice(fn.length+4)+' '+(100*v/tot).toFixed(1)+'%').join(' | '));
    const ph=[...T.phases].filter(([k])=>k.startsWith(fn+' @ ')).sort((a,b)=>b[1]-a[1]).slice(0,8);
    console.log('  '+fn+' by phase : '+ph.map(([k,v])=>k.slice(fn.length+3)+' '+(100*v/tot).toFixed(1)+'%').join(' | '));
  }
}

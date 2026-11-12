// In-memory instrumentation of src/simulation.js (repository untouched).
// Exclusive time per category (a nested category pauses its parent), call
// counters for the hot primitives, and a stack sample for slow route() calls.
import {rep} from './load.mjs';

export function makeCounters(slowMs=1){
  const C={cat:'other',t:0,time:{},calls:{},seg:{},rayCat:{},ground:0,blocked:0,ray:0,route:0,routeNull:0,routeDirect:0,routePath:0,
    astar:0,astarFail:0,explored:0,deferred:0,refresh:0,slow:[],slowMs,routeMs:0,
    sw(c){const t=performance.now();this.time[this.cat]=(this.time[this.cat]||0)+t-this.t;this.t=t;this.cat=c;},
    wrap(name,f,self,a){const p=this.cat;this.sw(name);this.calls[name]=(this.calls[name]||0)+1;try{return f.apply(self,a);}finally{this.sw(p);}},
    reset(){this.cat='other';this.t=performance.now();this.time={};this.calls={};this.seg={};this.ground=this.blocked=this.ray=0;this.route=this.routeNull=this.routeDirect=this.routePath=0;this.astar=this.astarFail=this.explored=this.deferred=this.refresh=0;this.routeMs=0;},
    close(){this.sw(this.cat);}
  };
  return C;
}

const WRAP=[
  ['plan','function plan(e){'],['cover','function cover(e){'],['peek','function peek(e){'],['perceive','function perceive(e){'],
  ['neuralPlan','function neuralPlan(e,dx,dz,d){'],['updateEncounters','function updateEncounters(dt){'],['safeEntry','function safeEntry(e,entry,encounter){'],
  ['updateBrain','function updateBrain(dt){'],['pumpNav','function pumpNav(limit=768){'],['refreshNav','function refreshNav(reset=true){'],['navigate','function navigate(e,dt){'],
  ['separate','function separate(dt){'],['canShoot','function canShoot(e,x,y,z){'],['updateDebris','function updateDebris(dt){'],['updateProjectiles','function updateProjectiles(dt){'],
  ['locomote','function locomote(dt,input){'],['hear','function hear(x,z,radius,y=groundAt(x,z)){'],['reactToShot','function reactToShot(){'],['returnToPost','function returnToPost(e,dt){'],
  ['attack','function attack(e){'],['burst','function burst(e){'],['updateEnvironment','function updateEnvironment(dt,damage=true){'],['updateBossAttacks','function updateBossAttacks(dt){'],
  ['tickBoss','function tickBoss(e,dt){'],['explode','function explode(point,r,damage,terrainPower,owner,shot=false,weakId=-1,ignoreId,kind){'],
  ['damageScenery','function damageScenery(point,power,r=0,direction,ignoreId){'],['fire',"function fire(assist=false,hand='right'){"],['syncDestruction','function syncDestruction(){'],
  ['clearLane','function clearLane(e,x,y,z,source=barrel(e,x,y,z).point){'],['updateHazards','function updateHazards(damage=true){'],['collectSupplies','function collectSupplies(){'],
  ['avoidBossZone','function avoidBossZone(e,dt){'],['rebuildNeighbors','function rebuildNeighbors(){'],['updateDirector','function updateDirector(dt){'],['updateSystems','function updateSystems(dt){'],
];

export function instrument(src,{wrap=true,extraWrap=[]}={}){
  src=rep(src,'function ground(x,z,activeTraps=trapStates){','function ground(x,z,activeTraps=trapStates){__C.ground++;');
  src=rep(src,'function blocked(x,z,r=.28,y=ground(x,z),doors=doorBoxes,staticBoxes=solids,traps=trapBoxes,height=1.8){','function blocked(x,z,r=.28,y=ground(x,z),doors=doorBoxes,staticBoxes=solids,traps=trapBoxes,height=1.8){__C.blocked++;');
  src=rep(src,'function ray(o,d,far=80){','function ray(o,d,far=80){__C.ray++;__C.rayCat[__C.cat]=(__C.rayCat[__C.cat]||0)+1;');
  src=rep(src,'function segmentFree(ax,az,bx,bz,r=.4){','function segmentFree(ax,az,bx,bz,r=.4){__C.seg[__C.cat]=(__C.seg[__C.cat]||0)+1;');
  src=rep(src,'function route(e,x,z){',"function route(e,x,z){__C.route++;const __p=__C.cat,__t=performance.now();__C.sw('route.direct');let __r;try{__r=__route(e,x,z);}finally{const d=performance.now()-__t;__C.sw(__p);__C.routeMs+=d;if(__r===null||__r===false)__C.routeNull++;else if(__r.length===0)__C.routeDirect++;else __C.routePath++;if(d>__C.slowMs)__C.slow.push({ms:+d.toFixed(2),res:__r===null?'null':__r===false?'defer':__r.length===0?'direct':'path'+__r.length,dist:+Math.hypot(x-e.x,z-e.z).toFixed(1),id:e.id,type:e.type,tactic:e.tactic,stack:new Error().stack.split('\\n').slice(2,6).map(s=>s.trim().replace(/\\(.*simulation\\.js:/,'(').replace(/^at /,'')).join(' < ')});}return __r;}function __route(e,x,z){");
  src=rep(src,'if(routeBudget<=0){routeDeferred++;',"if(routeBudget<=0){routeDeferred++;__C.deferred++;");
  src=rep(src,'const start=nearestNode(e.x,e.z,r),end=nearestNode(x,z,r);if(start<0||end<0)return null;',"__C.sw('route.nearest');const start=nearestNode(e.x,e.z,r),end=nearestNode(x,z,r);if(start<0||end<0)return null;");
  src=rep(src,'let explored=0,found=false;',"__C.sw('route.astar');__C.astar++;let explored=0,found=false;");
  src=rep(src,'if(!found)return null;','__C.explored+=explored;if(!found){__C.astarFail++;return null;}');
  src=rep(src,'const raw=[];for(let i=end;i>=0;i=routePrev[i])raw.push(i);raw.reverse();',"__C.sw('route.pull');const raw=[];for(let i=end;i>=0;i=routePrev[i])raw.push(i);raw.reverse();");
  src=rep(src,'const near=nearestNode(e.lastSeenX,e.lastSeenZ,.28);',"const __pc=__C.cat;__C.sw('plan.nearest');const near=nearestNode(e.lastSeenX,e.lastSeenZ,.28);__C.sw(__pc);");
  src=rep(src,'function refreshNav(reset=true){','function refreshNav(reset=true){__C.refresh++;');
  if(wrap)for(const [name,anchor] of [...WRAP,...extraWrap.filter(([n,a])=>src.includes(a))]){
    const args=anchor.slice(anchor.indexOf('(')+1,anchor.lastIndexOf(')'));
    src=rep(src,anchor,`function ${name}(...__a){return __C.wrap('${name}',__impl_${name},this,__a);}function __impl_${name}(${args}){`);
  }
  return src;
}

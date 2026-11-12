import {loadFast,WORLDS} from './lib.mjs';
const W=loadFast();
const only=process.argv[2];
for(const [label,idx,opts] of WORLDS){
  if(only&&!label.includes(only))continue;
  const w=W.FWorld.create(96,idx,opts);
  const keys=Object.keys(w);
  console.log('=====',label,'keys:',keys.join(','));
  console.log('bounds',JSON.stringify(w.bounds),'spawn',JSON.stringify(w.spawn),'exit',JSON.stringify(w.exit),'gen',w.generation,'stage',w.stage,'campaign',w.campaign,w.campaignVersion,'index',w.index);
  const f=w.walkable||[];const hist={};for(const a of f){const k=(a.substrate?'S':a.fallback?'F':(a.slopeX||a.slopeZ)?'R':'_')+':'+(Math.round((a.y||0)*100)/100);hist[k]=(hist[k]||0)+1;}
  console.log('walkable',f.length,JSON.stringify(hist));
  console.log('colliders',w.colliders.length,'boundaries',w.outdoorBoundaries?.length,'mechanisms',JSON.stringify((w.mechanisms||[]).map(m=>({id:m.id,x:m.x,y:m.y,z:m.z,required:m.required}))),'doors',JSON.stringify((w.doors||[]).map(d=>({id:d.id,x:d.x,z:d.z,requires:d.requires,y:d.y}))));
  console.log('lifts',JSON.stringify((w.lifts||[]).map(l=>({id:l.id,x:l.x,z:l.z,minY:l.minY,maxY:l.maxY,w:l.w,d:l.d,requires:l.requires}))),'pads',JSON.stringify((w.jumpPads||[]).map(j=>({id:j.id,x:j.x,y:j.y,z:j.z,r:j.r,t:j.target}))));
  console.log('cores',JSON.stringify(w.cores),'encounters',JSON.stringify((w.encounters||[]).map(e=>({id:e.id,x:e.x,z:e.z,r:e.radius,req:e.requires,waves:e.waves?.length,k:Object.keys(e).join('|')}))).slice(0,1500));
  console.log('trophies',JSON.stringify(w.trophies||[]).slice(0,600),'shops',JSON.stringify(w.shops||[]).slice(0,300),'arena',JSON.stringify(w.arena||w.bossArena||null).slice(0,300));
  console.log('enemies',w.enemies.length,'types',JSON.stringify(w.enemies.reduce((a,e)=>(a[e.type]=(a[e.type]||0)+1,a),{})),'progression',JSON.stringify(w.progression).slice(0,400));
}

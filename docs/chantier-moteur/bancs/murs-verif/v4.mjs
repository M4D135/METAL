import {readFileSync,readdirSync} from 'node:fs';
import {loadFast,loadRoot} from '../murs/lib.mjs';
const R=loadRoot((process.env.METAL_BANCS||process.cwd()+'/docs/chantier-moteur/bancs')+'/murs/work');
const RELIEF=['hill','cliff','cliff_stratum'],FLOOR=['arena_inlay','floor_drain','threshold','hazard_marking','trail','ground_patch','leaf_litter','jump_landing','dock_warning','trap_warning','arena_path_mark','trap_plate'];
const mk=floorClass=>(g,world)=>{
  const meshes=g.meshes.map(i=>world.meshes[i]),c=g.colliders.length?world.colliders[g.colliders[0]]:null,m=c?world.meshes[c.mesh]:null;
  if(meshes.some(q=>RELIEF.includes(q.category)))return 2;
  if(!c&&meshes.every(q=>FLOOR.includes(q.category)||q.s[1]<=.06&&!(q.r||[]).some(v=>Math.abs(v)>.01)))return floorClass;
  return g.kind==='wall'||g.kind==='roof'||!!m&&(m.category==='boundary'||g.kind==='support'&&Math.min(c.maxX-c.minX,c.maxZ-c.minZ)>=.6)?1:0;
};
const lightBase=src=>src.endsWith(':steam')||src.endsWith(':raté')||src==='joueur:balle';
const V=[['origine',null,()=>true],['finale (sols=2, écrasement lourd)',mk(2),s=>!lightBase(s)],['sols=1 lourd seulement, écrasement lourd',mk(1),s=>!lightBase(s)],['sols=2, lourd = grenade|roquette seulement',mk(2),s=>s.endsWith(':grenade')||s.endsWith(':rocket')],['sols=1, lourd = grenade|roquette seulement',mk(1),s=>s.endsWith(':grenade')||s.endsWith(':rocket')],['sols=0 (inchangés), lourd = grenade|roquette',mk(0),s=>s.endsWith(':grenade')||s.endsWith(':rocket')]];
const files=readdirSync('../murs').filter(f=>/^trace-.*-A.*\.json$/.test(f));const tot=V.map(()=>({steps:0,deb:0,armoredCutsBoss:0}));let secs=0;const srcAll={};
for(const file of files){
  const {summary,calls}=JSON.parse(readFileSync('../murs/'+file,'utf8'));secs+=summary.seconds;for(const c of calls)srcAll[c[1]]=(srcAll[c[1]]||0)+1;
  const world=R.FWorld.create(96,summary.index,{campaign:true,campaignVersion:2});
  V.forEach(([name,fn,heavyOf],vi)=>{
    const d=fn?R.FDestruction.create(world,{armor:fn}):R.FDestruction.create(world);const steps=new Set();const final=mk(2);const cls=new Map(world.destructibles.map(g=>[g.id,final(g,world)]));
    for(const [step,src,point,power,r,direction,ignoreId] of calls){const heavy=heavyOf(src);const res=r>0?d.blast(point,r,power,ignoreId,{heavy}):d.hit(point,power,direction,{heavy});
      if(res.changed){steps.add(step);tot[vi].deb+=res.debris.filter(q=>q.structural).length;if(src==='boss:boss')for(const e of res.events)if(e.name==='materialBreak'&&cls.get(e.sourceId)===1)tot[vi].armoredCutsBoss++;}}
    tot[vi].steps+=steps.size;
  });
}
console.log('traces',files.length,'durée',secs,'s sources',JSON.stringify(srcAll));
V.forEach(([name],i)=>console.log(name.padEnd(48),'pas avec révision',String(tot[i].steps).padStart(4),'('+(100*(tot[i].steps/tot[0].steps-1)).toFixed(0)+' %)','gravats',String(tot[i].deb).padStart(5),'('+(100*(tot[i].deb/tot[0].deb-1)).toFixed(0)+' %)','ruptures de groupes blindés par écrasement de boss',tot[i].armoredCutsBoss));

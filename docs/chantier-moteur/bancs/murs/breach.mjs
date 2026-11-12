// Nombre de tirs pour percer chaque genre/catégorie de décor, avec les puissances exactes de simulation.js.
// Chaque groupe échantillonné est isolé dans un mini-monde (mêmes maillages, mêmes colliders, même définition) :
// la création d'un contrôleur FDestruction y coûte quelques dizaines de µs au lieu d'un restore() complet.
import {loadFast} from './lib.mjs';
const W=loadFast();
const SOURCES=[
  ['pistolet (hit 2)','hit',2,0],['mitraillette (hit 2)','hit',2,0],['pompe 1 cartouche (7 plombs de 5)','pellets',5,0],['pompe 2 cartouches (14 plombs de 5)','pellets2',5,0],
  ['raté de roquette (hit 8)','hit',8,0],
  ['grenade joueur (blast r3,6 p34)','blast',34,3.6],['roquette joueur (blast r4,2 p55)','blast',55,4.2],
  ['grenade ennemie (r3,2 p28)','blast',28,3.2],['roquette ennemie (r3,4 p38)','blast',38,3.4],
  ['écrasement colosse (r4,3 p24)','blast',24,4.3],['barrage boss (r3,2 p34)','blast',34,3.2],['vapeur conduite (r2,25 p10)','blast',10,2.25]];
const worlds=[['v2-w01',0,{campaign:true,campaignVersion:2}],['v2-w02',1,{campaign:true,campaignVersion:2}],['v2-w03',2,{campaign:true,campaignVersion:2}],['hist-s1',0,undefined],['hist-s2',1,undefined],['hist-s3',2,undefined]];
const agg=new Map();
function mini(w,g){
  const map=new Map();g.meshes.forEach((i,k)=>map.set(i,k));
  const meshes=g.meshes.map(i=>w.meshes[i]),colliders=g.colliders.map(ci=>({...w.colliders[ci],mesh:map.get(w.colliders[ci].mesh)}));
  return {seed:w.seed,stage:w.stage,generation:w.generation,meshes,colliders,lights:[],pipes:[],destructibles:[{...g,meshes:g.meshes.map((_,k)=>k),colliders:g.colliders.map((_,k)=>k),supports:undefined,dependents:undefined}]};
}
for(const [label,index,opts] of worlds){
  const w=W.FWorld.create(96,index,opts);
  const byKey=new Map();
  for(const g of w.destructibles){if(!g.colliders.length)continue;const c=w.colliders[g.colliders[0]],m=w.meshes[c.mesh];const key=g.kind+'|'+(m.category||'sans:mat'+m.mat);if(!byKey.has(key))byKey.set(key,[]);byKey.get(key).push(g);}
  for(const [key,groups] of byKey){
    const sample=groups.filter((_,i)=>i%Math.max(1,Math.floor(groups.length/8))===0).slice(0,8);
    for(const g of sample){
      const mw=mini(w,g),c=mw.colliders[0],sx=c.maxX-c.minX,sz=c.maxZ-c.minZ,thinX=sx<sz;
      const y=Math.min(c.maxY-.05,Math.max(c.minY+.05,c.minY+Math.min(1.3,(c.maxY-c.minY)/2)));
      const point=thinX?[c.minX-.005,y,(c.minZ+c.maxZ)/2]:[(c.minX+c.maxX)/2,y,c.minZ-.005],dir=thinX?[1,0,0]:[0,0,1];
      for(const [name,type,power,radius] of SOURCES){
        const d=W.FDestruction.create(mw);let shots=0,first=null,collapsed=false,debris=0,changedAt=0,holeW=0,holeH=0;
        const vol0=d.colliders.reduce((v,q)=>v+(q.maxX-q.minX)*(q.maxY-q.minY)*(q.maxZ-q.minZ),0);
        for(let i=0;i<60&&!first;i++){
          shots++;let results=[];
          if(type==='hit')results=[d.hit(point,power,dir)];
          else if(type==='pellets'||type==='pellets2'){const n=type==='pellets'?7:14;for(let k=0;k<n;k++){const a=(k%7-1)*Math.PI/3,spread=k%7?.088*3:0;const pt=thinX?[point[0],point[1]+Math.sin(a)*spread,point[2]+Math.cos(a)*spread]:[point[0]+Math.cos(a)*spread,point[1]+Math.sin(a)*spread,point[2]];results.push(d.hit(pt,power,dir));}}
          else results=[d.blast([point[0]-(thinX?.05:0),point[1],point[2]-(thinX?0:.05)],radius,power)];
          for(const r of results)if(r.changed){first=r;changedAt=shots;collapsed=collapsed||r.collapsed.includes(g.id);debris+=r.debris.filter(q=>q.structural).length;}
        }
        const vol1=d.colliders.reduce((v,q)=>v+(q.maxX-q.minX)*(q.maxY-q.minY)*(q.maxZ-q.minZ),0);
        const k2=key+'|s'+g.strength+'@@'+name;if(!agg.has(k2))agg.set(k2,{n:0,shots:[],never:0,collapsed:0,debris:[],lost:[]});const a=agg.get(k2);a.n++;
        if(first){a.shots.push(changedAt);a.debris.push(debris);a.lost.push(vol0>0?1-vol1/vol0:0);if(collapsed)a.collapsed++;}else a.never++;
      }
    }
  }
}
const rows={};for(const [k,a] of agg){const [key,name]=k.split('@@');(rows[key]=rows[key]||{})[name]=a;}
const names=SOURCES.map(s=>s[0]);
console.log('genre|catégorie|résistance ; par source : tirs min..max avant la 1re coupe (x = jamais en 60 tirs), effondrement total / essais, gravats structurels moyens, volume solide perdu moyen');
for(const key of Object.keys(rows).sort()){
  console.log('\n'+key+'  (n='+rows[key][names[0]].n+')');
  for(const n of names){const a=rows[key][n];if(!a)continue;const s=a.shots;console.log('   '+n.padEnd(38)+(s.length?(Math.min(...s)+(Math.min(...s)!==Math.max(...s)?'..'+Math.max(...s):'')).padEnd(7):'x'.padEnd(7))+(a.never?' jamais:'+a.never+'/'+a.n:'').padEnd(14)+' effondré '+a.collapsed+'/'+a.n+'  gravats '+(a.debris.length?(a.debris.reduce((x,y)=>x+y,0)/a.debris.length).toFixed(1):'-')+'  volume perdu '+(a.lost.length?(100*a.lost.reduce((x,y)=>x+y,0)/a.lost.length).toFixed(0)+' %':'-'));}
}

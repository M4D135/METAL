import {loadFast,WORLDS} from './lib.mjs';
const W=loadFast();
const only=process.argv[2]||'v2-00';
for(const [label,idx,opts] of WORLDS){
  if(!label.includes(only))continue;
  const w=W.FWorld.create(96,idx,opts);
  console.log('rooms',JSON.stringify(w.rooms.map(r=>({id:r.id,x:+r.x.toFixed(1),z:+r.z.toFixed(1),w:r.w,d:r.d,y:r.y,out:r.outdoor,kind:r.kind,open:r.openings,k:Object.keys(r).join('|')}))).slice(0,4000));
  console.log('corridors',JSON.stringify(w.corridors).slice(0,3000));
  console.log('connections',JSON.stringify(w.connections).slice(0,2500));
  console.log('walkable',JSON.stringify(w.walkable.map(f=>({x:+f.x.toFixed(2),z:+f.z.toFixed(2),w:+f.w.toFixed(2),d:+f.d.toFixed(2),y:f.y,sx:f.slopeX,sz:f.slopeZ,sub:f.substrate,fb:f.fallback,k:Object.keys(f).join('|')}))).slice(0,5000));
  console.log('boundaries sample',JSON.stringify(w.outdoorBoundaries.slice(0,6)));
  const hs={};for(const b of w.outdoorBoundaries){const k=b.height+'@y'+(b.y||0)+'/'+b.region.split('-')[0];hs[k]=(hs[k]||0)+1;}console.log('boundary heights',JSON.stringify(hs));
  console.log('encounter0',JSON.stringify(w.encounters[0]).slice(0,1500));
  console.log('encounterBays',JSON.stringify(w.encounterBays).slice(0,800));
  console.log('enemy sample',JSON.stringify(w.enemies.slice(0,3)));
  console.log('collider sample',JSON.stringify(w.colliders.slice(0,3)),'keys',[...new Set(w.colliders.flatMap(c=>Object.keys(c)))].join(','));
  console.log('destructibles',w.destructibles?.length,JSON.stringify(w.destructibles?.slice(0,2)).slice(0,800));
}

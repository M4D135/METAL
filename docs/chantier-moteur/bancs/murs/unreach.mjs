import {loadFast,worldList} from './lib.mjs';
const W=loadFast();
for(const {label,index,opts} of worldList()){
  const w=W.FWorld.create(96,index,opts),v=W.FWorld.validate(w);
  if(v.ok){console.log(label,'ok');continue;}
  const targets=[['spawn',w.spawn],...w.cores.map((c,i)=>['core'+i,c]),['exit',w.exit],...w.enemies.map((e,i)=>['enemy'+i,e]),...w.pickups.map((p,i)=>['pickup:'+(p.id||i)+':'+(p.kind||p.type),p]),...(w.shops||[]).map(s=>['shop:'+s.id,s]),...(w.lifts||[]).flatMap(l=>[['liftLow',l.lowerCall],['liftUp',l.upperCall]]),...(w.mechanisms||[]).map(m=>['mech:'+m.id,{x:m.x,z:m.z+.95}]),...(w.jumpPads||[]).flatMap(p=>[['pad',p],['padTarget',p.target]])];
  const bad=v.errors.map(e=>{const m=/Unreachable target (\d+)/.exec(e);if(!m)return e;const [name,p]=targets[+m[1]];const room=w.rooms.find(r=>Math.abs(p.x-r.x)<=r.w/2&&Math.abs(p.z-r.z)<=r.d/2);return name+' @'+p.x.toFixed(1)+','+(p.y??0).toFixed?.(1)+','+p.z.toFixed(1)+' salle '+(room?room.id+(room.bossArena?'(arène)':''):'?')+' walkable='+W.FWorld.isWalkable(w,p.x,p.z,.38);});
  console.log(label,'ERREURS:',bad.join(' ; '));
}

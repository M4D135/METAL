import {loadFast} from '../sim/fast.mjs';
const ctx=loadFast(),{FWorld}=ctx.window;
for(const [label,idx,opts] of [['classic-0',0,undefined],['campaign-0',0,{campaign:true}],['campaign-9',9,{campaign:true}]]){
  const w=FWorld.create(96,idx,opts),C=w.colliders;let coTop=0,coSide=0,thin5=0,thin20=0,minT=9;const tops=new Set();
  const ov=(a0,a1,b0,b1)=>Math.min(a1,b1)-Math.max(a0,b0);
  for(const c of C){const t=Math.min(c.maxX-c.minX,c.maxZ-c.minZ);minT=Math.min(minT,t);if(t<=.05)thin5++;if(t<=.2)thin20++;tops.add(c.maxY.toFixed(2));}
  for(let i=0;i<C.length;i++)for(let j=i+1;j<C.length;j++){const a=C[i],b=C[j];
    const ox=ov(a.minX,a.maxX,b.minX,b.maxX),oz=ov(a.minZ,a.maxZ,b.minZ,b.maxZ),oy=ov(a.minY,a.maxY,b.minY,b.maxY);
    // dessus coplanaires (±6 mm = dans la tolérance d'appui) et boîtes jointives ou chevauchantes en plan
    if(Math.abs(a.maxY-b.maxY)<=.006&&ox>-.001&&oz>-.001&&(ox>.2||oz>.2)&&a.maxY<3)coTop++;
    // faces verticales coplanaires jointives (mur en plusieurs boîtes)
    if(oy>.3){for(const [f,g,o1,o2] of [[a.minX,b.minX,oz,0],[a.maxX,b.maxX,oz,0],[a.minZ,b.minZ,ox,0],[a.maxZ,b.maxZ,ox,0]])if(Math.abs(f-g)<=.006&&o1>-.001&&o1<.02){coSide++;break;}}
  }
  const fl=w.walkable||[],hs=new Set(fl.map(f=>(f.y??f.h??0).toFixed(2)));
  console.log(`${label}: ${C.length} colliders ; epaisseur min ${minT.toFixed(3)} m, <=5 cm: ${thin5}, <=20 cm: ${thin20} ; paires a dessus coplanaires jointifs (y<3 m): ${coTop} ; paires a faces verticales coplanaires bout a bout: ${coSide} ; hauteurs de dessus distinctes ${tops.size} ; sols: ${fl.length}, cles ${Object.keys(fl[0]||{}).join(',')}, hauteurs ${[...hs].join(' ')}`);
}

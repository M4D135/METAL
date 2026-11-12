import {loadFast,WORLDS} from '../saut/lib.mjs';
const W=loadFast();
for(const label of ['v2-00','v2-01','v2-02']){
  const e=WORLDS.find(w=>w[0]===label);const world=W.FWorld.create(96,e[1],e[2]);
  const authored=(x,z)=>world.walkable.some(f=>!f.substrate&&!f.fallback&&Math.abs(x-f.x)<=f.w/2&&Math.abs(z-f.z)<=f.d/2);
  const probe=W.FSimulation.create(world,{}),sp=probe.state.player;
  const walls=world.outdoorBoundaries.map(b=>world.colliders.find(c=>c.mesh===b.mesh)).filter(c=>Math.abs(c.minY-sp.y)<.1).map(c=>({c,cx:(c.minX+c.maxX)/2,cz:(c.minZ+c.maxZ)/2,alongX:(c.maxX-c.minX)>(c.maxZ-c.minZ)})).map(w=>({...w,d:Math.hypot(w.cx-sp.x,w.cz-sp.z)})).sort((a,b)=>a.d-b.d);
  const w=walls[0];
  for(const side of [1,-1])for(const fireSec of [1.5,3,6])for(const mode of ['balayage','bas','approche']){
    const ix=w.alongX?w.cx:w.cx+side*2.5,iz=w.alongX?w.cz+side*2.5:w.cz,ox=w.alongX?w.cx:w.cx-side*2.5,oz=w.alongX?w.cz-side*2.5:w.cz;
    if(!authored(ix,iz)||authored(ox,oz)||probe.blocked(ix,iz,.28,sp.y))continue;
    const sim=W.FSimulation.create(world,{}),s=sim.state,p=s.player;p.x=ix;p.z=iz;p.yaw=Math.atan2(w.cx-ix,-(w.cz-iz));
    const H=w.c.maxY-w.c.minY;let shots=0;
    for(let i=0;i<fireSec*60;i++){const dist=Math.max(.6,Math.abs(w.alongX?p.z-w.cz:p.x-w.cx)-.26);const ty=mode==='bas'?.15:mode==='approche'?H*.5:H*(.15+.8*((i%45)/45));p.pitch=Math.atan2(w.c.minY+ty-(p.y+1.62),dist);
      sim.step(1/60,{fire:true,weapon:s.weapon,moveX:0,moveY:mode==='approche'?1:0});shots+=s.events.filter(e=>e.name==='shot').length;s.events.length=0;p.hp=sim.stats.maxHp;}
    const id=world.meshes[w.c.mesh].destructibleId;const left=sim.destruction.colliders.filter(q=>q.destructibleId===id).map(q=>[(q.maxX-q.minX).toFixed(2),q.minY.toFixed(2)+'-'+q.maxY.toFixed(2),(q.maxZ-q.minZ).toFixed(2)].join('x'));
    p.pitch=0;let out=null;for(let k=0;k<300&&!s.dead;k++){sim.step(1/60,{moveX:0,moveY:1,sprint:true,weapon:s.weapon});s.events.length=0;if(!p.airborne&&!authored(p.x,p.z)&&Math.abs(p.y+.25)<.05){out=[+p.x.toFixed(1),p.y,+p.z.toFixed(1),+(k/60).toFixed(2)];break;}}
    console.log(label,'h',H.toFixed(2),'côté',side,mode,fireSec+'s',shots,'balles rév',s.destructionRevision,'| restes',left.join(' '),'| sortie',JSON.stringify(out),'mort',s.dead,'fin',[p.x.toFixed(2),p.y.toFixed(2),p.z.toFixed(2)].join(' '));
  }
}

import {loadFast,WORLDS} from '../saut/lib.mjs';
const W=loadFast();const world=W.FWorld.create(96,0,{campaign:true,campaignVersion:2});
const sim=W.FSimulation.create(world,{}),s=sim.state,p=s.player;
console.log('spawn',p.x,p.y,p.z,'weapon',s.weapon,'inv',JSON.stringify(s.inventory),'equip',JSON.stringify(s.equipment));
// nearest boundary to spawn
let best=null;for(const b of world.outdoorBoundaries){const c=world.colliders.find(c=>c.mesh===b.mesh);const d=Math.hypot((c.minX+c.maxX)/2-p.x,(c.minZ+c.maxZ)/2-p.z);if(Math.abs(c.minY-p.y)<.1&&(!best||d<best.d))best={c,d};}
const c=best.c,cx=(c.minX+c.maxX)/2,cz=(c.minZ+c.maxZ)/2;console.log('wall',JSON.stringify(c),'d',best.d.toFixed(1));
const alongX=(c.maxX-c.minX)>(c.maxZ-c.minZ);
// stand on the spawn side, 2.5 m away
const side=alongX?Math.sign(p.z-cz):Math.sign(p.x-cx);p.x=alongX?cx:cx+side*2.5;p.z=alongX?cz+side*2.5:cz;
p.yaw=Math.atan2(cx-p.x,-(cz-p.z));p.pitch=Math.atan2((c.minY+c.maxY)/2-(p.y+1.62),2.3);
console.log('ray',sim.ray([p.x,p.y+1.62,p.z],[Math.sin(p.yaw)*Math.cos(p.pitch),Math.sin(p.pitch),-Math.cos(p.yaw)*Math.cos(p.pitch)],20));
const names={};let open=-1;
for(let i=0;i<600;i++){sim.step(1/60,{fire:true,weapon:s.weapon,moveX:0,moveY:0});for(const e of s.events)names[e.name]=(names[e.name]||0)+1;s.events.length=0;if(open<0&&!sim.blocked(cx,cz,.28,p.y)){open=i/60;break;}}
console.log('open',open,'rev',s.destructionRevision,JSON.stringify(names),'ammo',JSON.stringify(s.inventory?.ammo));
const id=world.meshes[c.mesh].destructibleId;console.log('left',JSON.stringify(sim.destruction.colliders.filter(q=>q.destructibleId===id).map(q=>[q.minX.toFixed(2),q.maxX.toFixed(2),q.minY.toFixed(2),q.maxY.toFixed(2),q.minZ.toFixed(2),q.maxZ.toFixed(2)])));
// walk through
p.pitch=0;let out=null;for(let i=0;i<400&&!s.dead;i++){sim.step(1/60,{moveX:0,moveY:1,sprint:true,weapon:s.weapon});s.events.length=0;const a=world.walkable.some(f=>!f.substrate&&Math.abs(p.x-f.x)<=f.w/2&&Math.abs(p.z-f.z)<=f.d/2);if(!p.airborne&&!a){out=[p.x.toFixed(2),p.y.toFixed(2),p.z.toFixed(2),i];break;}}
console.log('out',JSON.stringify(out),'dead',s.dead,'pos',p.x.toFixed(2),p.y.toFixed(2),p.z.toFixed(2));
